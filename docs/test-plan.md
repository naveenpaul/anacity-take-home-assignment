# Test Plan

Updated 2026-05-28 to match the trimmed design: tenant + subdomain
white-labeling in POC scope; RLS, vanity domains, partitioning, and
temporal occupancy moved to production hardening (design doc §10).

Source of truth: `anacity_rearchitecture_design.md` §12 "Test strategy".
This doc is the QA-facing view (what to click, what to verify).

---

## Affected Pages / Routes

### Public + auth
- `GET  /` — root redirect / login on the tenant's subdomain
- `POST /v1/auth/login` — issues global identity JWT (httpOnly cookie)
- `POST /v1/auth/refresh` — token rotation

### Tenant resolution + branding
- Next.js `middleware.ts` — resolves tenant from `Host`, injects header
- `GET  /v1/tenants/resolve?host=...` — backend resolver (Redis-cached in
  production; DB lookup in POC)

### Multi-community surfaces
- `GET  /home` — cross-community unified feed (no `:communityId` in URL)
- `GET  /communities/:communityId/dashboard`
- `GET  /communities/:communityId/units`
- `POST /v1/communities/:communityId/units/:unitId/actions` — authz + UnitAction write
- `POST /v1/communities/:communityId/notices` — single-community notice
- `POST /v1/bulk/notices` — multi-community fan-out (server-side)

### Admin surfaces
- `/admin/roles` — create/edit role, manage permissions
- `/admin/memberships` — assign/revoke roles (with optional block/unit scope)
- `/admin/branding` — edit tenant branding (logo, primary color)

### Internal
- Redis (production): `ability:*`, `domain:*` key namespaces

---

## Key Interactions to Verify

### Identity + login
- Login on tenant subdomain → user sees only their communities for that tenant
- Same global token works across all of a user's tenants (carol logged in on
  `prestige.localhost` sees only Lakeside; on `sobha.localhost` sees only
  Dream Acres — same identity, scoped per host)
- Logout invalidates the cookie

### Multi-community within one tab (Pattern 1 — switcher)
- Community-switcher dropdown lists every community the user has a
  membership in
- Selecting a community navigates to `/communities/:id/dashboard`
  (client-side route, no full reload)
- URL bar reflects the selection; back/forward buttons navigate correctly
- Permissions on the new page match the new community (different ability
  set per community)
- **No server-side session is mutated** — verifiable by inspecting that
  no API call fires during the switch other than the data fetch for the
  new route

### Multi-community within one tab (Pattern 2 — unified `/home`)
- `/home` lists all of the user's communities in one feed
- Per-community summary cards (pending visitors, open tickets) populate
  in parallel — each one is an independent authorized fetch
- Recent-activity feed mixes events from multiple communities, each
  labeled with its community
- Clicking an action button (e.g. "Approve" on a Lakeside visitor)
  fires `POST /v1/communities/c_lakeside/.../actions` — the page URL
  stays `/home`
- After the action, the feed updates without a full page reload

### Multi-community within one tab (Pattern 3 — bulk fan-out)
- `/admin/notices/compose` lets the user multi-select communities they
  have `create_notice` permission in
- Submit fires N parallel `POST /v1/communities/:id/notices` (or one
  `POST /v1/bulk/notices`); each authorized independently
- Result UI shows per-community success/failure ("3/3 sent" or
  "2/3 — Marina failed: permission denied")
- A partial failure does not roll back the successful sends

### Multi-tab (sanity check the statelessness)
- Tab 1 on `/communities/c_falcon/dashboard`, Tab 2 on
  `/communities/c_lakeside/dashboard` — both render correctly and
  independently
- Action fired in Tab 2 (Lakeside) does NOT affect Tab 1's view or context
- Refreshing either tab preserves its community context (because context
  lives in the URL, not the session)
- Token rotation in one tab does not break the other

### Dynamic RBAC
- Admin creates a custom role in UI → assigns it → target user
  immediately gains the capability (cache invalidation correctness in
  production; resolved per request in POC)
- Admin revokes a role → target user loses access on the **very next
  request**
- Editing a role's permissions → affects every user holding that role
  on their next request
- Block-scoped grant: user can act only within their block, denied in
  sibling blocks
- A brand-new permission key created via system-template seeding
  becomes assignable from the role-edit UI

### Cross-app branding propagation (Next.js + NestJS integration)
- Admin updates branding via NestJS admin API
- Next.js fetches fresh tenant on next request
- New branding renders **without client-side reload** — page colors,
  logo, favicon update on next navigation
- No flash of unbranded content during the transition

---

## Edge Cases

### Tenancy / isolation
- Unknown Host/subdomain → clean reject (404/redirect), not a 500
- Non-member hits a community route → 403 (cross-community isolation)
- User/token from tenant A hits tenant B community → denied (membership
  check, no row visible)
- `Tenant.slug` uniqueness — two tenants cannot register the same slug
- Community admin attempts to grant self a platform/elevated permission
  → blocked (privilege escalation)

### RBAC
- Block-scoped grant: user can act only within their block, denied in
  sibling blocks
- Re-add a previously soft-deleted membership → succeeds (partial
  unique index handles this)
- Deleting a Role with active grants → soft-deletes role, existing
  grants retained for audit
- Editing a role mid-action: the action's authz uses the ability
  snapshot at request-start, not a half-mutated cache

### UnitAction
- UnitAction write with inconsistent hierarchy (block not in community,
  community not in tenant) → rejected at the service layer
- UnitAction update attempt → rejected (append-only / immutable)
- UnitAction read after a unit is renamed → audit shows the original
  snapshot (IDs + label captured at write time), not the renamed values

### Multi-community UX
- Switching community via picker mid-form: form state preserved or
  cleanly discarded with confirmation, never silently sent to the wrong
  community
- Bulk action where the user has permission in only some of the
  selected communities → only the permitted ones succeed; UI shows
  per-community result
- Two tabs on the same community, both editing → optimistic concurrency
  or last-write-wins behavior is consistent and documented
- Browser back button from `/communities/c_falcon/...` to `/home` →
  no stale data, no stuck loading state

---

## Critical Paths (must work / must fail correctly)

### Isolation (highest stakes)
- ISOLATION: cross-tenant data read denied (token from tenant A,
  request for tenant B's community → 403/404)
- ISOLATION: cross-community read denied within the same tenant
  (membership in C1, request for C2 → 403)
- ISOLATION: same user logged into both tenants sees only the correct
  communities per host

### Security
- SECURITY: privilege escalation blocked (no self-grant of elevated
  perms)
- SECURITY: revoked permission takes effect same-request

### Multi-community guarantees (the architecture's headline behavior)
- STATELESSNESS: action against community X carries community X in
  URL, regardless of what page URL the user is on
- STATELESSNESS: switching community in the picker mutates zero server
  state — only client routing
- STATELESSNESS: multi-tab to different communities does not leak
  between tabs (no shared session)
- BULK FAN-OUT: partial bulk failure leaves the system in a consistent
  per-community state, never half-applied

### White-labeling
- BRANDING: tenant subdomain → correct brand renders server-side, no
  flash
- BRANDING: branding update propagates to Next.js on next request, no
  client reload
- BRANDING: unknown subdomain (no matching tenant) → clean reject, not
  the wrong tenant's branding

### Migration regressions (mandatory before any tenant cuts over in production)
- MIGRATION REGRESSION: existing users still log in after cutover
- MIGRATION REGRESSION: each existing fixed role maps to a dynamic role
  with identical effective permissions (assert permission-set equality,
  not name)
- MIGRATION REGRESSION: existing unit ↔ user associations become
  Membership rows with no data loss

---

## What this plan does NOT cover

These are intentionally out of scope of the POC (called out in design
doc §10 as production hardening):

- **DB-layer tenant isolation via Postgres RLS** — POC enforces at the
  app layer with `where tenant_id = ?` scoping; RLS is the defense-in-depth
  upgrade.
- **Vanity apex domains** (`prestige.com`) — POC uses subdomains under
  one wildcard pattern; Caddy on-demand TLS / Let's Encrypt is staging+prod.
- **Partitioned UnitAction via pg_partman** — single indexed table at
  POC volume.
- **Temporal UnitOccupant** (owner/tenant/family, start/end dates) —
  POC has simple Membership; ownership-history tests run against the
  hardened model.
- **Real billing/plan limits** (Tenant.settings reserved for future)
- **Mobile app behavior** (web-only design)
