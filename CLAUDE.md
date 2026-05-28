# CLAUDE.md

Repo-specific guidance for AI coding agents working in this repository.

## Design System

Always read [`DESIGN.md`](./DESIGN.md) before making any visual or UI
decisions. All font choices, colors, spacing, border radii, and
aesthetic direction are defined there. Do not deviate without explicit
user approval. In QA mode, flag any code that doesn't match DESIGN.md.

Quick reference for the most-violated rules:

- **Typography:** Geist Sans + Geist Mono only. Never Inter, Roboto,
  Arial, Helvetica, or `system-ui` as the primary face.
- **Border radius:** `0 / 2px / 4px / 9999px`. Never use Tailwind
  defaults like `rounded-md` (6px) or `rounded-lg` (8px) on cards or
  panels — those are reserved for inputs (`rounded` = 4px) or
  forbidden entirely.
- **Brand accent:** the tenant's `primaryColor` flows through
  `--brand-primary`. Use it for primary CTAs, focus rings, and
  selected states. Never use it for body text or default borders.
- **Decoration:** none. No gradients, no shadows on cards, no
  decorative SVGs, no glassmorphism. Hairline borders only.
- **Monospace cue:** IDs, timestamps, permission keys, hex codes —
  all render in Geist Mono. This is a semantic signal, not a stylistic
  choice.

See DESIGN.md §11 for the full anti-slop reject list.

## Architecture

The canonical architecture doc is
[`anacity_rearchitecture_design.md`](./anacity_rearchitecture_design.md).
Read it before changing the data model, RBAC layer, or tenant
resolution flow. Scope rationale is in
[`docs/scope-rationale.md`](./docs/scope-rationale.md) — it explains
what was deliberately cut from the POC.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
