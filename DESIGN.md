---
version: alpha
name: Onlifit-design-system
description: "A monochrome, trust-first trainer marketplace built on pure black (#000000) as the single interactive/brand color, white and light-gray surfaces, and a strict Poppins-display / Inter-body typographic pairing. The system is deliberately restrained — no secondary brand color, no decorative gradients — so trust signals (ratings, verified badges, trainer photography) carry the visual weight instead of chrome. Cards are soft-rounded (16–48px scale) with ambient shadows rather than hard borders. WhatsApp is the primary conversion action across the product, always rendered as a high-contrast pill CTA."

colors:
  primary: "#000000"
  primary-container: "#F5F5F5"
  on-primary: "#FFFFFF"
  secondary: "#1A1A1A"
  secondary-container: "#F5F5F5"
  secondary-fixed-dim: "#D8D8D8"
  on-secondary: "#FFFFFF"
  tertiary: "#333333"
  tertiary-container: "#EBEBEB"
  tertiary-fixed-dim: "#666666"
  on-tertiary: "#FFFFFF"
  background: "#F5F5F5"
  surface: "#FAFAFA"
  surface-container-lowest: "#FFFFFF"
  surface-container-low: "#FFFFFF"
  surface-container: "#F0F0F0"
  surface-container-high: "#E0E0E0"
  surface-container-highest: "#CCCCCC"
  surface-variant: "#F8F8F8"
  surface-dim: "#EEEEEE"
  on-surface: "#000000"
  on-surface-variant: "#666666"
  outline: "#D0D0D0"
  outline-variant: "#E8E8E8"
  error: "#1A1A1A"
  error-container: "#F5F5F5"
  whatsapp-green: "#25D366"

typography:
  h1:
    fontFamily: Poppins
    fontSize: "1.875rem / 2.25rem (mobile/desktop: text-3xl lg:text-4xl)"
    fontWeight: 900
  h2:
    fontFamily: Poppins
    fontSize: "1.5rem / 1.875rem (text-2xl lg:text-3xl)"
    fontWeight: 900
  h3:
    fontFamily: Poppins
    fontSize: "1.25rem (text-xl)"
    fontWeight: 700
  h4:
    fontFamily: Poppins
    fontSize: "1.125rem (text-lg)"
    fontWeight: 700
  body:
    fontFamily: Inter
    fontSize: "1rem (text-base)"
    fontWeight: 400
  body-sm:
    fontFamily: Inter
    fontSize: "0.875rem (text-sm)"
    fontWeight: 400
  caption:
    fontFamily: Inter
    fontSize: "0.75rem (text-xs)"
    fontWeight: 400
  button:
    fontFamily: Inter
    fontSize: "0.875rem–1rem"
    fontWeight: 700

rounded:
  DEFAULT: 16px
  lg: 32px
  xl: 48px
  full: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.DEFAULT}"
    padding: 16px 32px
    fontWeight: 700
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    border: "2px solid {colors.primary}"
    rounded: "{rounded.DEFAULT}"
    padding: 16px 32px
    fontWeight: 700
  button-whatsapp:
    backgroundColor: "{colors.whatsapp-green}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: 12px 24px
    fontWeight: 700
  trainer-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
    shadow: ambient
    border: "1px solid {colors.outline-variant}/20"
  badge:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  goal-chip:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    border: "2px solid {colors.outline}"
    rounded: "{rounded.full}"
    padding: 10px 16px
  goal-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    border: "2px solid {colors.primary}"
    rounded: "{rounded.full}"
  top-nav:
    backgroundColor: "rgba(255,255,255,0.8) + backdrop-blur"
    border-bottom: "1px solid {colors.outline-variant}/30"
  text-input:
    backgroundColor: "{colors.surface-container-low}"
    border: "1px solid {colors.outline-variant}/30"
    rounded: "{rounded.DEFAULT}"
    padding: 12px 16px
---

## Overview

Onlifit is a two-sided trainer marketplace: users discover trainers, evaluate them via profile + packages, and convert via a WhatsApp enquiry. The existing implementation (verified directly in `tailwind.config.js`, `trainers.html`, `trainer-profile.html`) already establishes a **monochrome, restraint-first identity** — this document codifies that identity, not a new one.

This corrects a drift: `STYLE_GUIDE.md` describes a coral/teal palette that is **not what is implemented**. Per project priority (existing code and architecture outrank documentation), this DESIGN.md reflects the real, shipped system.

**Key Characteristics:**
- Pure black (`{colors.primary}` #000000) is the *only* interactive/brand color — no secondary chromatic accent.
- White/light-gray surface ladder (`background` → `surface` → `surface-container` → `surface-container-high`) carries hierarchy without color.
- Poppins (font-black/900) for all headings; Inter for body, labels, and UI text.
- Soft, generous rounding: 16px default, 32px cards, 48px hero elements, full pill for chips/buttons.
- **WhatsApp green (#25D366)** is the one deliberate exception to monochrome — reserved exclusively for the primary conversion action (contact/enquiry), so it reads as "this is how you take action," never decorative.
- Glass-effect (`backdrop-blur` + translucent white) fixed nav.
- Ambient, soft shadows — never harsh — consistent with the "premium SaaS" feel required by `UI_RULES.md`.

## Colors

### Brand & Accent
- **Primary** (`{colors.primary}` #000000): CTAs, active states, filled goal chips, brand wordmark.
- **On Primary** (`{colors.on-primary}` #FFFFFF): text on black surfaces.
- **WhatsApp Green** (`{colors.whatsapp-green}` #25D366): reserved exclusively for the "Contact via WhatsApp" CTA family — the single non-monochrome color in the system, and it must stay scarce and purposeful.

### Surface
- **Background** (#F5F5F5): page floor.
- **Surface** (#FAFAFA) / **Surface Container Lowest/Low** (#FFFFFF): cards, modals, search bar.
- **Surface Container** (#F0F0F0) → **High** (#E0E0E0) → **Highest** (#CCCCCC): stepped hierarchy for nested/hovered/selected states.

### Text
- **On Surface** (#000000): primary heading/body text.
- **On Surface Variant** (#666666): secondary/meta text.

### Borders
- **Outline** (#D0D0D0) / **Outline Variant** (#E8E8E8): all hairline borders, typically applied at reduced opacity (e.g. `/20`, `/30`).

## Typography

- **Headline family**: Poppins — weight 900 (black) for h1/h2, 700 (bold) for h3/h4. Never mix weights within the same heading level.
- **Body/label family**: Inter — 400 default, 500/600 for emphasis, 700 for buttons/CTAs.
- Base is 16px (`text-base`) with a fixed scale (`text-xs` through `text-4xl`) — **no arbitrary sizes** (`text-[14px]` is explicitly disallowed by `STYLE_GUIDE.md` and should stay disallowed).

## Layout & Spacing

- Mobile-first, no horizontal scroll, no content hidden behind the fixed nav (per `UI_RULES.md`).
- Standard page shell: fixed glass nav → `pt-24/32` hero → `max-w-7xl` content → dark (`bg-secondary`) footer.
- Card grids follow a marketplace density pattern (closer to Airbnb than to Apple): 3–4 up desktop, 2 up tablet, 1 up mobile — never edge-to-edge full-bleed tiles.

## Shapes & Elevation

- Rounding scale: `rounded` 16px (buttons, inputs) → `rounded-lg` 32px (cards) → `rounded-xl` 48px (hero panels) → `rounded-full` (chips, avatars, WhatsApp CTA).
- Shadows are ambient and soft (`shadow-ambient`, `shadow-elevated`) — never a hard, dark drop shadow. This matches Apple's "one purposeful shadow tier" discipline, adapted to Onlifit's lighter, warmer surface (not literally copied).

## Components

### Buttons
- **`button-primary`**: black fill, white text, bold, 16px radius — used for primary marketplace actions (Search, Filter, Book).
- **`button-secondary`**: black outline, black text — secondary actions.
- **`button-whatsapp`**: WhatsApp green fill, full-pill radius — always paired with a chat icon, e.g. "Get Connected on WhatsApp." This is the marketplace's equivalent of Airbnb's "Reserve" — the single most important CTA on any trainer profile — but must stay visually distinct (green, pill) from the black CTA family so it reads unambiguously as "message this person," not a generic action.

### Trainer Cards (marketplace core — Airbnb-informed structure only)
Adopt Airbnb's **card anatomy**, not its color or type:
- Photo-first trainer image, `rounded-lg` clipping.
- Floating trust badge (e.g., "Verified", "Top Rated") top-left — same slot Airbnb uses for "Guest favorite," rendered in Onlifit's own `badge` token (tertiary-container fill), never a copied pill shape/color.
- Meta block beneath: name (`h3`/Poppins), specialty tags (`goal-chip` style), rating, price-from, WhatsApp CTA pinned bottom or bottom-sticky on profile pages (mirrors Airbnb's `reservation-card` sticky-rail → sticky-bottom-bar mobile pattern).

### Navigation
- `top-nav`: fixed, glass-effect, translucent white + blur — already implemented, keep as-is. Do not adopt Apple's opaque-black or Linear's near-black nav; Onlifit's nav stays light and airy.

### Goal Chips / Filters
- Pill-shaped, 2px outline default, filled black when active. This existing pattern is correct and should not be replaced by a segmented pill-search bar (Airbnb's 3-segment search) — that would move Onlifit too close to Airbnb's specific silhouette.

## Do's and Don'ts

### Do
- Keep `{colors.primary}` #000000 as the only chromatic-adjacent brand action color; keep WhatsApp green scoped strictly to contact CTAs.
- Use Poppins/900 for headings and Inter for everything else — no other typeface substitutions, regardless of what Taste skills suggest.
- Use the existing 16/32/48/pill rounding scale exactly; do not introduce Framer/Stripe-style oversized 24–30px "spotlight card" radii.
- Borrow Airbnb's *card anatomy* (photo + floating badge + meta stack + pinned CTA) and *sticky contact rail* pattern for trainer profiles.
- Borrow Apple's *restraint discipline*: one shadow philosophy, alternating light/gray section backgrounds instead of heavy borders, generous section padding, and a narrow, deliberate weight ladder (avoid mid-weight 500 clutter in headings).
- Apply Taste-skill techniques (scroll-reveal micro-motion, magnetic button press states, `transform`/`opacity`-only animation, mobile-safe blur/z-index discipline) only insofar as they enhance the *existing* black/white/Poppins/Inter system.

### Don't
- Don't introduce Airbnb's Rausch red, Apple's Action Blue, or any of the awesome-design-md gradient/accent palettes as a second brand color.
- Don't adopt high-end-visual-design's banned-font rule (it explicitly bans Inter) — Inter is Onlifit's actual body font and stays.
- Don't adopt gradient mesh backdrops, spotlight cards, or glass "Ethereal" OLED-black vibes from the Taste skill's default archetypes — none match Onlifit's light, trust-first identity.
- Don't copy Airbnb's literal pill 3-segment search bar or "Guest favorite" badge wording/shape — structure only, not silhouette.
- Don't move trainer cards toward Apple's edge-to-edge, chrome-free tile format — a marketplace needs visible card density for comparison shopping.
- Don't touch existing page layouts/functionality to chase these principles — per project priority, stability and existing architecture come first; this document guides *future* refinement, not a redesign mandate.

## Known Gaps / Open Items

- `STYLE_GUIDE.md` should eventually be updated or retired in favor of this document to avoid future drift (not done here — inspection/proposal only, per instructions).
- Dark mode: `tailwind.config.js` sets `darkMode: 'class'` but no dark-mode token set is implemented anywhere in the inspected pages — out of scope until requested.
- No formal motion/animation tokens exist yet in the codebase; the Taste skills' motion guidance (transform/opacity-only, custom easing, IntersectionObserver reveals) is a reasonable default to adopt *when* animation work is requested, but nothing here mandates adding it.
