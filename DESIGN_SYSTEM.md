# LifeBook Visual Design System v1

The single source of truth for LifeBook's visual language. Implemented in
`src/index.css` via Tailwind v4 `@theme` tokens — always prefer tokens over
raw values. A regression guard (`test/design-tokens-check.ts`, runs in
`npm test`) fails the build if default Tailwind palette classes, stray
radius scales, or bare `rounded` classes creep back in.

## Principles

1. **Content over chrome** — memories, photos, and people are the heroes.
2. **Whitespace creates importance** — generous spacing communicates calm and premium quality.
3. **Emotional hierarchy** — Primary → Secondary → Supporting → Decorative. Not everything competes.
4. **Human first** — "Your story is growing", never "Data synchronization successful".
5. **No dark patterns** — never fake urgency, hidden settings, or manipulative hierarchy.

## Color System

Distribution target: **70% warm neutrals · 20% green/sage · 7% secondary · 3% strong emphasis**.

### Foundation (70%)

| Token | Hex | Use |
|---|---|---|
| `--color-brand-bg` | `#F7F4ED` | Page background (warm ivory) |
| `--color-brand-surface` / `-card` | `#FCFBF7` | Cards (warm white) |
| `--color-brand-cream` / `-beige` | `#EFE9DD` | Fills, hover wells |
| `--color-brand-paper` | `#F1EFEC` | Paper tint, wells |
| `--color-brand-text` / `-dark` | `#1E2521` | Deep ink headings |
| `--color-brand-muted` | `#454A46` | Body charcoal |
| `--color-brand-faint` | `#8A8F8B` | Quiet metadata |
| `--color-brand-border` | `#E5E5E1` | Hairlines |

### Primary accent (20%) — muted forest

| Token | Hex | Use |
|---|---|---|
| `--color-brand-primary` | `#315C4A` | Primary buttons, active nav, progress |
| `--color-brand-primary-hover` | `#27493A` | Pressed state |
| `--color-brand-sage` | `#7E9B89` | Softer accents |
| `--color-brand-sage-soft` | `#B8C9BD` | Selection, borders |
| `--color-brand-sage-pale` | `#E2EBE4` | Active-nav pills, callouts |

### Secondary accents (7% — sparing)

| Token | Hex | Use |
|---|---|---|
| `--color-brand-gold` | `#C9A66B` | Milestones, legacy moments, gold CTA text on ink |
| `--color-brand-terracotta` | `#B4543E` (danger) / `#C9826B` | Errors, destructive, emotional highlights |
| `--color-brand-lavender` | `#AAA0C9` | AI features only |

### Dark surfaces (§9 — never pure black)

Cinematic contexts (photo viewer, scrims) use warm deep forest-ink, not slate:
`#141A16` (scrims) → `#1E2521` (surface) → `#2A322C` (raised) with cream type
`#FCFBF7` and white-alpha borders (`rgba(252,251,247,0.10–0.25)`).

**Rules:**
- Accent text opacity steps: `#1A1A1A/70` → `#454A46`; `/50` `/40` → `#8A8F8B`.
- Semantic reds are terracotta-tinted (`#B4543E`, `#9E4132`, `[#F9EFEB]` tints), never Tailwind red.
- The guard enforces this: any `bg-red-50`-style class fails the build.

## Typography

| Role | Face | Scale |
|---|---|---|
| Display / hero / emotional headings | `font-serif` — Playfair Display (italic for warmth) | Hero 48–72px · Page title 36–48px · Section 24–32px · Card 18–22px |
| Interface — nav, buttons, forms, metadata | `font-sans` — Inter | Body 14–16px · Labels 11–12px uppercase `tracking-[0.12em]` |
| Technical — IDs, keys, codes, ledger labels | `font-mono` — JetBrains Mono | 10–12px, usually uppercase micro-labels |

Italic serif is LifeBook's emotional signature ("Your story matters.", "Your story awaits").

## Radius System

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 10px | Inputs, small buttons, chips |
| `--radius-md` | 16px | Cards, wells, message rows |
| `--radius-lg` | 24px | Large cards, hero panels, media tiles |
| `--radius-xl` | 32px | Feature panels |
| `--radius-2xl` | 40px | Floating overlays |
| `rounded-full` | 999px | Pills, avatars, dots |

Never use Tailwind's `rounded-lg`/`xl` scale or bare `rounded` — the guard enforces this.

## Elevation (soft natural light — never heavy black)

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px … 0.04` | Resting cards |
| `--shadow-md` | two-layer ≤ `0.06` | Hovered cards, floating memory chips |
| `--shadow-lg` | two-layer ≤ `0.09` | Dropdowns, popovers |
| `--shadow-float` | two-layer ≤ `0.12` | Modals, the 3D hero scene |

## Motion System

| Tier | Duration | Easing | Examples |
|---|---|---|---|
| Micro | 120–180ms | ease-out | Hover, press, focus, toggles |
| Standard | 200–350ms | ease-out | Fades, color transitions, small slides |
| Large | 350–600ms | `cubic-bezier(0.22,1,0.36,1)` | `animate-rise-in` (page/hero entrance) |
| Ambient | 2–8s | ease-in-out | `animate-breathe` (AI orb), `animate-ambient-float` (3D cards) |

**Rules:**
- Animate `transform` and `opacity` only — never layout properties.
- Content entrances: `animate-fade-in` / `animate-rise-in` (both defined in `index.css`).
- Ambient float supports `--float-rotate` and `--float-scale` custom properties.
- `prefers-reduced-motion: reduce` disables all ambient/entrance animation and collapses transitions globally (enforced in `index.css`).
- Never animate merely because animation is possible.

## 3D Language (§12–14)

Subtle depth represents memory, time, and story — implemented with pure CSS
(perspective + layered shadows + gradients). No WebGL, no Three.js.

Current composition: the **memory-book scene** (`book-scene` in `index.css`,
used in `DashboardHome`) — an open book with three floating memory cards and a
gold star. The book is a stable anchor; only the cards float, slow and
staggered. The scene is decorative: always `aria-hidden="true"` +
`pointer-events-none`, hidden on small screens.

Depth stack: Background → Ambient blur → Main surface → Floating card → Interactive object → Foreground detail.
Keep blur/shadow/perspective restrained — users should notice quality, not technique.

## Glass (§15)

Used only for: floating navigation (mobile bottom bar), overlays, floating controls.
`bg-[#FCFBF7]/90 backdrop-blur-md border-t border-[#E5E5E1]` is the pattern.
Content cards stay opaque and readable.

## Layout & Navigation

- **Desktop**: sticky glass header + quiet sidebar (`#FCFBF7`, hairline divider, sage-pale active pill).
- **Mobile**: bottom navigation (`app-mobile-nav`) with the 4 high-frequency destinations (Home, Memories, Timeline, Family) + "More" opening the drawer. Content gets `pb-24` to clear it. Safe-area aware via `env(safe-area-inset-bottom)`.
- Responsive compositions, not shrunk desktops: heroes stack, the 3D scene hides under `md`, grids collapse 4→2→1.

## Copywriting

- Empty states: name the moment, then invite ("Your story awaits" + a clear action).
- Errors: calm, specific, actionable — "We couldn't save that memory. Please try again." Never "ERROR 500", never "Failed to …".
- Placeholders: personal ("Search your memories, people, or moments...").
- Success: quiet confirmation, no intrusive popups for small actions.

## Accessibility

- Visible focus: global `:focus-visible` outline in forest green.
- Keyboard: bottom nav and drawer buttons are real `<button>`s with `aria-current`/`aria-label`/`aria-expanded`.
- Contrast: charcoal `#454A46` on cream passes; faint `#8A8F8B` is metadata-only.
- Reduced motion: enforced globally.
- Decorative elements (3D scene, orbs, ambient blurs): `aria-hidden="true"`, `pointer-events-none`.

## Guardrails (automated)

`test/design-tokens-check.ts` (in `npm test`) fails on:
1. Any Tailwind default-palette class (`bg-red-500`, `text-sky-400`, `slate-*`, …).
2. Any Tailwind radius scale (`rounded-lg`/`xl`/…) or bare `rounded`.
3. Cold slate remnants anywhere in `src/`.

When adding UI: use the tokens, run `npm test`, and extend the guard only with a deliberate design decision.

## Known Ceilings

- `ponytail:` Dark mode is a one-way token set, not a toggleable theme — light is canonical; dark surfaces exist only for cinematic contexts.
- `ponytail:` The 3D scene is a fixed composition (no drag/parallax interaction) — deliberate, per §36; upgrade path is a pointer-tracked tilt with reduced-motion gating if ever justified.
- `ponytail:` Fonts load from Google Fonts CDN (no self-hosting yet) — acceptable for current traffic; revisit for offline/privacy-critical deployments.
