# Majal — Design Resource Guide

> A curated reference of best-in-class professional design systems, mapped onto
> Majal's stack (Vite + React + shadcn/ui + Radix + Tailwind) and brand contract
> ("Quiet Clinical" teal, DM Serif/Sans, French/Arabic RTL). Companion to
> `DESIGN.md` — this guide tells you **where to look** and **what to borrow**.

---

## 1. Tier-1 Design Systems Worth Studying (and what Majal takes from each)

| System | Link | What Majal borrows |
|---|---|---|
| **shadcn/ui** | ui.shadcn.com | Already our component base. Use its theming model: CSS variables → Tailwind tokens. Study its form/dialog/table patterns. |
| **Radix Primitives / Themes** | radix-ui.com | Accessibility backbone (focus traps, ARIA, keyboard). Never fight it — style it. Radix Themes' color-step system (1–12 steps per hue) is the model for our `teal.*` scale. |
| **IBM Carbon** | carbondesignsystem.com | Best-in-class token architecture (global → contextual → component tokens) and grid/spacing discipline. Mirror its "token naming = role, not value" rule. |
| **Shopify Polaris** | polaris.shopify.com | Best documentation voice & content guidelines for sensitive/trust contexts; excellent empty-state and feedback patterns. |
| **Material Design 3** | m3.material.io | Reference for state layers (hover/press/focus opacity ramps), tonal palettes, and accessible color-role semantics. |
| **Atlassian Design System** | atlassian.design | Strong "design + content + accessibility together" structure; good pattern docs for loading/empty/error states. |
| **Microsoft Fluent 2** | fluent2.microsoft.design | Cross-platform density and RTL support guidance at scale. |
| **Apple HIG** | developer.apple.com/design/human-interface-guidelines | Touch targets, typography legibility, calm-motion principles for the mobile/responsive layer. |
| **Salesforce Lightning** | lightningdesignsystem.com | Enterprise form patterns and healthcare-adjacent trust cues. |
| **Ant Design** | ant.design | Data-heavy dashboard patterns (stats, tables, filters) relevant to therapist/admin views. |

**Meta-references (craft & taste):**
- *Refactoring UI* (Wathan & Schoger) — grayscale-first hierarchy, hairline borders over shadows: already codified in DESIGN.md §11.
- **godly.website**, **mobbin.com**, **land-book.com** — visual trend libraries.
- **Linear.app**, **Stripe.com/docs**, **Vercel.com**, **Notion.so** — live product surfaces that embody the restrained-modern direction DESIGN.md §11 cites.

---

## 2. Domain-Specific References (health / mental-health / trust)

- **NHS Digital Design System** (service-manual.nhs.uk) — the gold standard for
  clinical-grade UI: plain language, high contrast, generous spacing,
  crisis-information prominence. Directly applicable to Majal's crisis banner
  (`#C2453D` destructive/crisis role).
- **Headspace / Calm / Woebot / Talkspace apps** (browse via Mobbin) — tone of
  microcopy, onboarding pacing, session-booking flows for therapy platforms.
  Note: they gamify more than Majal should — take warmth, not playfulness.
- **WCAG 2.2** (w3.org/TR/WCAG22) — AA contrast is contractual (DESIGN.md §11.8).
  Key additions worth adopting: focus appearance (2.4.13), target size minimum
  24px (2.5.8) — we exceed it with ≥40–44px.
- **Inclusive Components** (inclusive-components.design) — accessible patterns
  for tooltips, cards-as-links, menus.

---

## 3. Typography Resources

| Need | Resource |
|---|---|
| Current brand fonts | **DM Serif Display** + **DM Sans** (Google Fonts) |
| Arabic body/UI companion | **IBM Plex Sans Arabic** or **Noto Sans Arabic** (pair with DM Sans metrics); editorial serif alternative: Noto Naskh Arabic |
| Scale & rhythm generator | type-scale.com (use 1.2–1.25 ratio against the DESIGN.md §3 scale) |
| Fluid sizing | clamp() calculators; utopia.fyi |
| Line-height rule | Latin body 1.5–1.6; **Arabic body ≥1.8** and font-size +10–15% vs Latin (diacritics need room) |

---

## 4. RTL & Bilingual (FR/AR) Toolkit

Majal is RTL-first-class (DESIGN.md §12.12). Key references and rules:

- **W3C RTL pages**: w3.org/International/questions/qa-html-dir — use `dir="rtl"` on `<html>`/subtrees, never CSS hacks.
- **MDN CSS Logical Properties** — always `ms-/me-/ps-/pe-/start/end` utilities; zero hardcoded left/right.
- **Mirror checklist** (the bugs that scream "translated site"):
  - directional icons (arrows, chevrons, progress) flip; media icons (play, volume, clocks) do NOT;
  - numbers/phones/Latin snippets stay LTR via `<bdi>` or `dir="ltr"` inline;
  - breadcrumbs, form labels AND error messages align consistently;
  - drawer slides from logical `start`;
  - test both locales side by side before merge.
- **Arabic-specific**: cursive script → no letter-spacing on Arabic text (tracking breaks ligatures); uppercase labels are a Latin-only concept — Arabic labels rely on weight/color instead of `.section-label` tracking.

---

## 5. Tooling & Workflow

| Purpose | Tool |
|---|---|
| Component source of truth | shadcn/ui CLI (`npx shadcn@latest add …`) |
| Variant management | class-variance-authority (already installed) |
| Icons | Lucide (`lucide-react`) — stroke-consistent, matches hairline aesthetic; avoid mixing icon families |
| Color/token checking | Tailwind config as single source; contrast checkers: webaim.org/resources/contrastchecker, polychroma.app |
| Figma parity | Figma variables mirroring `tailwind.config.ts` tokens; community shadcn/ui Figma kit |
| Motion | tailwindcss-animate (installed); honor `prefers-reduced-motion`; 150–200ms ease-out only (DESIGN.md §11.7) |
| Visual QA | Browser dev-tools RTL toggle + Lighthouse a11y audit per release |

---

## 6. Curated Reading List

1. *Refactoring UI* — Wathan & Schoger (foundation of §11 principles)
2. Carbon Design System → "Guidelines > Tokens"
3. Polaris → "Content" guidelines (tone for sensitive contexts)
4. M3 → "Color system" (state layers, roles)
5. NHS Digital Service Manual → health-specific patterns
6. W3C i18n articles on bidi/RTL
7. Smashing Magazine's "Design Systems" and "Arabic Web Design" article series

---

## 7. Quick Rules Card (print-worthy)

- One accent (teal). Semantic amber/rose only where meaningful.
- Hairline first, shadow second, blur never.
- Radius tokens only (`sm/md/lg/xl/full`) — no arbitrary px.
- 8px spacing scale; grouping space > inner space.
- Serif for headings ≤500 weight; sans for everything else; Arabic gets bigger sizes + looser leading, tighter nothing.
- Every interactive element: visible focus ring, ≥40px target, one primary action per view.
- Logical properties everywhere; test FR and AR on every screen change.
- Empty/loading states designed, not defaulted.
