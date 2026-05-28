# Anacity Design System

> Serious infrastructure, type-driven, near-zero decoration. The
> product carries weight through typography, whitespace, and one
> sharp accent — never through gradients or ornament. Visual peers:
> Linear, Stripe Dashboard, Vercel, Plaid.

This document is the single source of truth for visual decisions in
the Anacity codebase. Any UI work — new pages, refactors, third-party
integrations — must conform to it. If a decision isn't covered here,
ask before improvising.

---

## 1. Product context

- **What this is.** A tenant-aware multi-community SaaS for residential
  property management. Customers like Prestige and Sobha each own
  multiple communities; each community has blocks and units; residents,
  security, managers, and admins all live as global users with
  per-community role grants.
- **Who it uses it.** Property managers (heavy, daily, hours at a time),
  resident-facing admins (intermittent), residents (occasional, mobile).
  Primary surface is the admin tool, not a marketing site.
- **Space.** B2B property tech / community management SaaS. Peers in the
  space (AppFolio, Buildium, Hemlane) are functional but visually
  underbuilt — opportunity to look like serious infrastructure software
  instead of a vertical CRM.
- **Project type.** Web app: admin surfaces dominate; a thin auth/landing
  surface; no marketing site in scope.

## 2. The memorable thing

> "Serious infrastructure" — Linear/Stripe/Vercel energy.

When a reviewer opens the app, the first three seconds should read as
"this is software a real business runs on," not "this is a take-home
demo." Every downstream choice in this document serves that one
sentence.

---

## 3. Aesthetic direction

| Attribute | Choice | Why |
|---|---|---|
| **Direction** | Utilitarian-modern, type-driven | Matches the technical depth (RBAC, audit, multi-tenancy) of the architecture |
| **Decoration level** | Minimal | Hairline borders + whitespace + type do all the work. No gradients, no decorative SVGs, no glassmorphism, no soft drop shadows |
| **Mood** | Restrained, alert, content-led | The interface should feel like it was edited down to 80% by someone who deleted everything that didn't earn its place |
| **Reference apps** | Linear, Stripe Dashboard, Vercel, Plaid, Mercury, Cron | All convergent on the same idea: type + whitespace + one sharp accent + tight grids |

---

## 4. Typography

**One family across the entire UI.** Multi-family pairings (display +
body) are an old-SaaS tell; senior B2B tools converge on a single
grotesque for everything.

| Role | Font | Notes |
|---|---|---|
| Display / page titles | **Geist Sans** | Weight 600, tracking tight on titles |
| Body / UI labels | **Geist Sans** | Weight 400 default, 500 for emphasis |
| Data / tables / numeric | **Geist Sans** with `font-variant-numeric: tabular-nums` | Lined columns; no alignment fights |
| IDs / timestamps / permission keys / hex colors | **Geist Mono** | The "infrastructure" cue — used wherever a value is a key, not prose |
| Code blocks | **Geist Mono** | Same family as IDs |

**Why Geist:** OFL-licensed (free), Vercel-quality drawing, designed
for UI. Geist Sans + Geist Mono are siblings — they share metrics so
mixing them on the same row doesn't fight.

**Loading.** Self-host via the `geist` npm package and Next.js
`@next/font`. No Google Fonts CDN — adds a network hop and is privacy-
unfriendly.

**Type scale (modular, base 16px):**

```
12  caption, dense table cells, footnotes
13  small labels, secondary metadata
14  default body, table content
16  primary body, form inputs
18  section labels
22  page subtitles
28  page titles
36  marketing headlines (used sparingly)
48  hero (login/landing only)
```

**Weights used:** 400 (body), 500 (UI labels, table headers), 600 (page
titles). Not 700 — too heavy for a Sans this clean.

**Forbidden:** Inter, Roboto, Arial, Helvetica, system-ui as the primary
face. Any decorative or script font. Any font with a single "trendy"
weight (e.g. light-only).

---

## 5. Color

**Restrained, tenant-aware.** One sharp accent (the tenant's brand
color, applied dynamically) + neutrals + muted semantic colors. The
brand bleeds into the interface itself — focus rings, primary CTAs,
key/value highlights — not just the header logo.

### Light mode

| Token | Hex | Use |
|---|---|---|
| `--surface-base` | `#FFFFFF` | Page background |
| `--surface-raised` | `#FAFAFA` | Cards, panels |
| `--surface-muted` | `#F4F4F5` | Subtle backgrounds, hover states |
| `--text-primary` | `#0A0A0A` | Body text, headings |
| `--text-secondary` | `#525252` | Metadata, secondary labels |
| `--text-tertiary` | `#A3A3A3` | Disabled, placeholder, timestamps in feeds |
| `--border-default` | `#E5E7EB` | Hairline borders on cards, panels, table rows |
| `--border-strong` | `#D4D4D8` | Inputs, buttons, dividers |

### Dark mode (real first-class mode, not a tinted recolor)

| Token | Hex | Use |
|---|---|---|
| `--surface-base` | `#0A0A0A` | Page background |
| `--surface-raised` | `#171717` | Cards, panels |
| `--surface-muted` | `#262626` | Subtle backgrounds |
| `--text-primary` | `#FAFAFA` | Body text, headings |
| `--text-secondary` | `#A3A3A3` | Metadata, secondary labels |
| `--text-tertiary` | `#525252` | Disabled, placeholder |
| `--border-default` | `#262626` | Hairline borders |
| `--border-strong` | `#404040` | Inputs, buttons, dividers |

### Tenant accent (dynamic)

Loaded from `Tenant.branding.primaryColor` at render time and set on
`--brand-primary` in the layout. Default fallback: `#525252` (neutral
gray) when no tenant is resolved.

- Prestige seed: `#0047AB` (Vercel-blue-adjacent)
- Sobha seed: `#16A34A` (forest green)

**Where the accent appears:**
- Primary CTA buttons
- Focus rings (`box-shadow: 0 0 0 2px var(--brand-primary)`)
- Active nav state
- Brand swatches (header logo, preview panels)
- Key/value highlight rules (e.g., the left border on a granted role row)

**Where the accent does NOT appear:**
- Body text — always `--text-primary`
- Borders (default state) — always neutral
- Semantic states (success/warning/error/info) — those keep their own colors

### Semantic colors (muted, mode-aware)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--success` | `#16A34A` | `#22C55E` | Confirmed actions, healthy status |
| `--warning` | `#D97706` | `#F59E0B` | Pending, attention |
| `--danger` | `#DC2626` | `#EF4444` | Errors, destructive actions |
| `--info` | `#2563EB` | `#3B82F6` | Informational banners |

Use sparingly — these are status signals, not decoration. A page
should not have more than one semantic color visible at a time except
in lists (e.g., a multi-row status column).

---

## 6. Spacing

**Base unit: 4px.** Smaller base than 8px gives flexibility for dense
admin UI without losing the rhythm.

| Token | px | Use |
|---|---|---|
| `space-0` | 2 | Hairline gaps |
| `space-1` | 4 | Icon-to-text |
| `space-2` | 8 | Tight grouping (table cells, inline labels) |
| `space-3` | 12 | Default form field padding |
| `space-4` | 16 | Card padding (tight), section-to-section in forms |
| `space-6` | 24 | Card padding (default), form field spacing |
| `space-8` | 32 | Section gaps |
| `space-12` | 48 | Page-level vertical rhythm |
| `space-16` | 64 | Marketing / auth page generous breathing |
| `space-24` | 96 | Top-of-page padding on hero surfaces |

**Density:** compact in tables (8/12px row padding), comfortable in
forms (16/24px), spacious in marketing/auth (48/64px).

---

## 7. Layout

**Approach:** grid-disciplined for app surfaces, slightly looser for
auth/marketing.

| Surface | Max width | Notes |
|---|---|---|
| Admin (`/home`, `/c/*`, `/admin/*`) | `1280px` content-led | Sidebar nav comes in iteration 2 if page set grows; for now header + breadcrumb does navigation work |
| Auth (`/login`) | `420px` | Centered, generous vertical breathing |
| Landing (root, no tenant) | `640px` | Same — emphasize the brand swatches as the visible payoff |

### Border radius scale (sharp, intentional — not Tailwind defaults)

| Token | px | Use |
|---|---|---|
| `radius-none` | 0 | Tables, dividers, full-bleed panels |
| `radius-sm` | 2 | Cards, panels, badges |
| `radius-md` | 4 | Form inputs, buttons |
| `radius-full` | 9999 | Avatars, status dots, pills |

**Forbidden:** the default Tailwind `rounded-md` (6px), `rounded-lg`
(8px), `rounded-xl` (12px) on anything but pills. They read as
"framework defaults" immediately.

### Shadows

**None on cards or panels.** Use hairline borders instead. The only
allowed shadow is a focus ring (`box-shadow: 0 0 0 2px
var(--brand-primary)`), and that's not really a shadow.

---

## 8. Motion

**Minimal-functional.** No entrance choreography, no scroll-driven
animation, no auto-playing transitions.

| Type | Duration | Easing |
|---|---|---|
| Button press | 100ms | `ease-out` |
| Hover | 150ms | `ease-out` |
| Focus ring appear | 100ms | `ease-out` |
| Page transitions (Next.js router) | default | default |
| Modal / sheet enter | 200ms | `ease-out` |
| Modal / sheet exit | 150ms | `ease-in` |

**Forbidden:** scroll-jacking, parallax, hover-driven layout shifts,
loading skeletons that "shimmer" with gradient sweeps.

---

## 9. Component patterns

### Buttons

- **Primary:** filled with `--brand-primary`, white text, `radius-md`,
  `padding: 8px 14px`, weight 500
- **Secondary:** transparent background, `--border-strong` border,
  `--text-primary`, same padding
- **Ghost:** transparent, no border, `--text-primary`, used for
  destructive secondary actions like "Revoke" or "Cancel"
- **Destructive:** transparent background, `--danger` text — never
  filled red. A filled red button is a confirmation dialog, not a row
  action.

### Forms

- Inputs: `radius-md` (4px), `padding: 8px 12px`, `--border-strong`
  border, white background, `text-sm` (14px)
- Labels: `text-xs` (12px) `font-medium`, `--text-secondary`,
  `margin-bottom: 4px`
- Help text: `text-xs`, `--text-tertiary`, `margin-top: 4px`
- Focus state: 2px `--brand-primary` ring, no border color change

### Tables

- Header row: `text-xs` (12px), `font-medium`, `--text-secondary`,
  `text-transform: uppercase`, `letter-spacing: 0.025em`
- Body row: `text-sm` (14px), `--text-primary`
- Hairline divider between rows (`--border-default`)
- Numeric columns: `font-variant-numeric: tabular-nums`, right-aligned
- ID / timestamp columns: `font-mono` (`Geist Mono`),
  `--text-secondary`

### Badges / pills

- `radius-full`, `text-xs` (12px), `padding: 2px 8px`
- Subtle: `--surface-muted` background, `--text-secondary` text
- Status: tinted background (10% opacity of semantic color) + matching
  text color at full strength

### Cards

- `--surface-raised` background, `--border-default` border,
  `radius-sm` (2px)
- Padding: `24px` default, `16px` compact

---

## 10. Mode switching

**Light mode is the only shipping mode in the POC.** Admin tools are
read for hours; the default should be predictable and not flip out
from under the user when their OS theme changes. `prefers-color-scheme`
is intentionally NOT respected.

The dark-mode token values in §5 are defined for the day a manual
toggle ships (likely user-preference column on `User` + a header
control). When that lands:
- Dark mode reduces saturation on semantic colors by ~15% to avoid
  vibrating reds and greens on dark backgrounds.
- Hairline borders stay visible in both modes (1px against a contrasting
  surface).
- The tenant accent stays the same hex in both modes — surrounding
  neutrals do the work.

Default mode: **light**. Dark mode: deferred (opt-in toggle, not OS-driven).

---

## 11. Anti-slop rules

These are reasons to reject a design choice without further debate:

- ❌ Purple/violet gradient anywhere
- ❌ 3-column feature grid with icons in colored circles
- ❌ Centered-everything pages
- ❌ Bubble-radius (`rounded-xl` or larger) on anything that isn't an avatar or pill
- ❌ Gradient-fill primary buttons
- ❌ Stock-photo-style hero sections
- ❌ `system-ui` or `-apple-system` as the display font (the "I gave up on typography" signal)
- ❌ "Built for X" / "Designed for Y" marketing copy
- ❌ Soft drop shadows on cards (use hairline borders)
- ❌ Generic loading skeletons that gradient-shimmer

---

## 12. The risks this system deliberately takes

Documented so reviewers and future contributors understand the
choices were intentional, not defaults.

1. **Tenant brand IS the UI accent.** Most multi-tenant SaaS keeps
   brand color out of the chrome to stay neutral. Anacity does the
   opposite: Prestige users see blue focus rings and CTAs, Sobha users
   see green. The brand bleeds into the product itself, not just the
   logo. *Tradeoff: semantic colors must coexist; mitigated by keeping
   success/warning/error mode-aware and at full strength regardless of
   accent.*

2. **Monospace as a semantic signal.** UUIDs, permission keys,
   timestamps, and hex codes all render in Geist Mono — not as styled
   small gray text. *Tradeoff: an extra font weight to load; mitigated
   because Geist Mono shares metrics with Geist Sans.*

3. **Sharp corners (0–2px) on cards and panels.** Most Tailwind defaults
   round to 6–12px. Anacity does not. *Tradeoff: some users associate
   sharp corners with "harsh"; mitigated by keeping inputs at 4px and
   leaving generous whitespace.*

---

## 13. Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-28 | Initial design system created | `/design-consultation` session; "serious infrastructure" direction chosen over "approachable property tech" and "quiet craft." Tenant-accent-as-UI-color and mono-as-semantic-signal accepted as deliberate risks. |
