# DESIGN.md — Majal Brand Contract

> Single, coherent, professional mental-health brand for an Algerian / French / Arabic
> audience. Direction: **"Quiet Clinical"** — calm, warm, trustworthy, light-first.
> NOT dark, NOT neon, NOT glassy. One accent color family (teal). Semantic
> amber (warning) and muted rose (destructive / crisis) only where meaningful.

This contract is the single source of truth. Every component in `src/` is refactored
to obey it. Logic, routing, data, and French/Arabic copy are untouched.

---

## 1. Visual Theme & Atmosphere
- Light-first, soft, paper-like surfaces. Airy whitespace, generous padding.
- Warm calm: a faint green-teal clinical hue, never cold blue, never magenta.
- Trustworthy structure: clear cards, hairline borders, restrained elevation.
- Motion is subtle (hover lift, fade-up). No spinning/looping decoration.
- RTL-safe: symmetric / logical styles only (no hardcoded LTR edges).

---

## 2. Color Palette & Roles
| Token | Value | Role |
|---|---|---|
| Canvas (background) | `hsl(150 14% 98%)` | App background |
| Surface (card) | `#FFFFFF` | Cards, panels |
| Hairline border | `hsl(170 18% 90%)` | Default borders (`border-border`) |
| Primary (brand teal) | `#0F6E6A` / `hsl(178 75% 24%)` | Brand accent, buttons, active |
| Primary hover | `#0C5A57` | Hover/active of primary |
| Primary soft tint | `hsl(178 50% 94%)` | Badges, selected bg, chips |
| Text foreground | `hsl(180 30% 14%)` | Headings + body |
| Text muted | `hsl(178 12% 42%)` | Secondary text |
| Success (calm green) | `#2E7D5B` | Positive confirmations |
| Warning (muted amber) | `#B5842F` | Pending / caution |
| Destructive / crisis (muted rose) | `#C2453D` | Crisis banner, destructive actions only |

Forbidden: magenta, `emerald-*`, `blue-*`, `purple-*`, `indigo-*`, `teal-500`,
rainbow gradients, glassmorphism. Off-brand Tailwind colors are routed to the
`teal.*` utilities / semantic tokens above.

---

## 3. Typography Rules
- Headings: **DM Serif Display** (brand character). Keep weight ≤ 500 where calm.
- Body / UI: **DM Sans** (300–600).
- Type scale:
  - Display: 40–48px / serif
  - H1: 32px / serif
  - H2: 26px / serif
  - H3: 22px / serif
  - H4: 18px / serif
  - Body: 15–16px / sans
  - Small: 13–14px / sans
  - Caption: 12px / sans
  - Label: 11–12px uppercase, tracked, muted

---

## 4. Component Stylings
- **Buttons**: `rounded-full` for primary CTAs and pills; `rounded-lg` for utility
  buttons. Primary = solid `bg-primary text-primary-foreground`; secondary =
  `border border-primary text-primary bg-transparent` (hover `bg-teal-pale`).
  No neon, no heavy shadow.
- **Cards**: `#FFFFFF`, `border border-border`, `rounded-lg` (16px), resting shadow
  scale. Hover: subtle lift only.
- **Inputs**: white surface, `border-border`, `rounded-lg`, focus `ring-2 ring-primary/30`.
- **Badges / pills**: `rounded-full`, soft tint bg (`bg-teal-pale` + `text-primary`),
  hairline border. Semantic variants use amber/rose tints.
- **Nav items**: active = soft teal tint + left/right accent bar (RTL-aware), no glass.

---

## 5. Layout Principles
- 8px base spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Content max-width container, centered, comfortable gutters (`px-[5%]` / container).
- Sidebars fixed 256px (`w-64`); top bars sticky solid (no blur).

---

## 6. Depth & Elevation (shadow scale)
- Resting: `0 1px 2px rgba(15,110,106,.06), 0 1px 3px rgba(15,110,106,.08)`
- Elevated: `0 4px 12px rgba(15,110,106,.10)`
- Overlay / modal: `0 12px 40px rgba(15,110,106,.18)`
- NO 24px+ blur shadows. NO glassmorphism — prefer solid surfaces.

---

## 7. Do's and Don'ts
**Do**: one accent family, hairline borders, calm serif headings, RTL-safe layout,
consistent radius, solid surfaces, restrained motion.
**Don't**: emoji as decoration, `animate-pulse` except genuine live indicators,
`✅` in toasts, `backdrop-blur`/frosted glass, rainbow gradients, magenta, neon.

---

## 8. Responsive Behavior
- Mobile-first. Sidebars collapse to drawers; top bars remain sticky solid.
- Grids reflow 1→2→4 columns at `sm`/`lg`. Touch targets ≥ 40px.

---

## 9. Radius Scale (single source)
- `sm` 8px · `md` 12px · `lg` 16px · `xl` 20px · `full` (buttons + avatars)
- Defined in `tailwind.config.ts` (`borderRadius`) and mirrored by `--radius`.

---

## 10. Agent Prompt Guide
When restyling a component: (1) keep all `onClick`/handlers/labels intact;
(2) replace off-brand color classes with `teal.*` / `primary` / semantic tokens;
(3) drop `backdrop-blur` and use solid `bg-card`/`bg-white`;
(4) use radius tokens, not `rounded-[..px]`;
(5) never use emoji glyphs or `✅`; (6) keep RTL symmetry via `ms-/me-` or
dir-aware utilities; (7) do not alter French/Arabic copy meaning.

---

# 11. Modern Direction (2025 / 2026)

Evolved from the "Quiet Clinical" base using current product-design practice
(Linear / Vercel / Notion / Stripe / Arc / Raycast visual language, Refactoring UI,
godly.to & Mobbin trends, Stephen Few's data-ink discipline). The brand identity
is preserved exactly — only the *system* around it is modernized.

### 11.1 Adopted design principles (synthesis)
1. **Grayscale-first hierarchy.** Build hierarchy from spacing, size, weight and
   contrast. The single teal accent is applied last, only to denote meaning/action.
2. **Hairline borders over shadows.** Default separation is a 1px `border-border`.
   Shadows are reserved for true elevation (floating panels, modals, hover).
3. **Soft, layered elevation.** Three planes only — canvas → surface → floating —
   expressed via background tint + hairline + a small, teal-tinted shadow. No blur.
4. **Constrained 8px spacing scale.** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Group
   spacing > within-group spacing. Start airy, then tighten.
5. **One accent, used sparingly.** Teal marks interactive/active only. Semantic
   amber/rose appear strictly where they communicate status (pending / crisis).
6. **Refined typography system.** DM Serif Display for display & section titles with
   tight tracking (`tracking-tight`); DM Sans for UI. Stable scale, 1.5–1.6 line
   height for body, `max-w-prose` (~65ch) measure for long copy.
7. **Purposeful, fast motion.** Hover/state transitions `150–200ms` ease-out, using
   only `transform`/`opacity`/`background`/`border-color` (GPU-friendly). No loops.
   Honor `prefers-reduced-motion`.
8. **Accessible by default.** Visible `focus-visible` ring (`ring-2 ring-primary/40`);
   touch targets ≥ 40–44px; WCAG AA contrast on all text/semantic pairs.
9. **Consistent component vocabulary.** One treatment for buttons, inputs, cards,
   chips, nav, lists, modals — see §12. Radius tokens are the single source.
10. **Content-first, scannable layout.** Modular/Bento grids; one clear primary
    action per view; useful empty + loading (skeleton) states; strong scan lines.
11. **Warm, humane tone.** Calm microcopy, soft tints, rounded but not bubbly.
    Mental-health context → reassuring, never gamified, never emoji-decorated.
12. **RTL-safe, logical styling.** All spacing/edges use `ms-/me-/ps-/pe-` and
    `start/end` so Arabic mirrors the French layout without extra work.

### 11.2 Modern additions to the token layer (in `src/index.css` + `tailwind.config.ts`)
- `--shadow-rest` / `--shadow-card` / `--shadow-hover` / `--shadow-overlay` retained.
- New helpers (see §12): `.surface`, `.surface-elevated`, `.hairline`, `.chip`,
  `.chip-soft`, `.input-field`, `.seg`, `.stat`, `.section-head`, `.focus-ring`.
- Global `:focus-visible` ring; global `prefers-reduced-motion` guard.

---

# 12. Component Vocabulary (modern treatment)

Every interactive surface uses one of these. Utilities live in `src/index.css`
(`@layer components`); pages compose them with tokens.

### 12.1 Surfaces
- `.surface` — `bg-card border border-border rounded-lg` (the default panel).
- `.surface-elevated` — `bg-card border border-border rounded-lg shadow-card`
  for panels that float above content (drawers, popovers).
- `.hairline` — `border border-border` separator utility.

### 12.2 Cards (`.card`)
Base: `bg-card border border-border rounded-lg shadow-rest`.
Hover (interactive): lift `-translate-y-0.5`, border → `border-primary/25`,
shadow → `shadow-card`; transition `180ms` ease-out.
Use `.dashboard-card` (already defined) for primary content cards; it maps to this.

### 12.3 Buttons (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`)
- `.btn` — shared: `inline-flex items-center justify-center gap-2 rounded-full
  text-sm font-medium px-5 py-2.5 transition-colors duration-150 focus-visible:ring-2
  focus-visible:ring-primary/40 focus-visible:outline-none` (touch target ≥ 40px).
- `.btn-primary` — `bg-primary text-primary-foreground hover:bg-teal-mid
  active:bg-teal-cta shadow-rest`.
- `.btn-secondary` — `border border-primary text-primary bg-transparent
  hover:bg-teal-pale`.
- `.btn-ghost` — `text-muted-foreground hover:text-foreground hover:bg-accent/40
  rounded-lg` (utility / icon buttons).
- Utility/icon buttons: `rounded-lg` (not full).

### 12.4 Inputs (`.input-field`)
`w-full bg-card border border-border rounded-lg px-4 py-3 text-sm
placeholder:text-muted-foreground outline-none transition
focus:border-primary focus:ring-2 focus:ring-primary/25 focus:bg-white`.
Textareas inherit the same.

### 12.5 Chips / Badges (`.chip`, `.chip-soft`)
- `.chip` — `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]
  font-semibold` with a variant:
  - default/brand: `bg-teal-pale text-primary border border-primary/15`
  - success: `bg-teal-pale text-success border border-success/20`
  - warning: `bg-teal-pale text-warning border border-warning/20`
  - danger: `bg-rose-50 text-danger border border-danger/20`
- `.chip-soft` — tint-only, no border (lower emphasis).

### 12.6 Navigation
- Sidebar items: `.glass-nav-item` (accent bar on active, RTL-aware) + active
  `bg-teal-pale text-primary`. Icon scales `1.1` on active.
- Top bars / nav: sticky solid `bg-card border-b border-border`, no blur.
- Segmented filters (categories/tabs): `.seg` — a hairline container with
  `rounded-full` pills; active pill `bg-primary text-primary-foreground`.

### 12.7 Lists & Feeds
- Thread/post rows: `.card` with `hover:border-primary/25`, clear title
  (serif H4), 2-line clamp excerpt (`line-clamp-2`), meta row (chip + date +
  reply count) separated by a hairline.
- Empty state: centered icon (low opacity) + one-line message, on `.surface` padding.
- Loading state: skeleton blocks (`.skeleton`) matching card rhythm.

### 12.8 Modals / Drawers (`.surface-elevated`)
- Overlay `bg-black/30`; panel `bg-white rounded-2xl shadow-overlay`.
- Drawer (RTL-aware): slides from `start`; `animate-in slide-in-from-*`.
- Close affordance: `.btn-ghost` round icon.

### 12.9 Stats / Metrics (`.stat`)
`bg-card border border-border rounded-lg p-5` with a small uppercase label
(`.section-label`) + large serif number + delta chip. Used on dashboards.

### 12.10 Section heading (`.section-head`)
`font-serif text-xl font-semibold text-foreground` + optional `.section-label`
(11–12px uppercase tracked muted) subtitle. One primary action aligned `end`.
