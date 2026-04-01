# Design System Strategy: The Luminous Mentor

## 1. Overview & Creative North Star

**Creative North Star: "The Elevated Sanctuary"**
This design system moves beyond the "standard startup" look to create a digital environment that feels breathable, prestigious, and deeply human. We are moving away from the rigid constraints of a typical grid-based web app and toward an editorial, search-first experience that prioritizes clarity and visual delight.

The system breaks the "template" look through:
*   **Intentional Asymmetry:** Utilizing generous, uneven white space to guide the eye toward focal points like search bars and primary headlines.
*   **High-Contrast Scale:** Combining massive `display-lg` typography with compact, functional `label-sm` metadata to create a sophisticated editorial rhythm.
*   **Weightless Depth:** Replacing heavy borders with tonal shifts and multi-layered shadows that make components feel like they are floating in a sunlit room.

## 2. Colors & Surface Logic

Our palette is anchored by the vibrant `primary` (#b52330) and `primary_container` (#ff5a5f), supported by a deep, intelligent `secondary` indigo (#4b41e1). 

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to separate sections. Structure is defined exclusively through background shifts. For example, a main content area (`surface`) should transition into a footer or sidebar using `surface_container_low` or `surface_container_highest`. 

### Surface Hierarchy & Nesting
Treat the UI as physical layers of fine paper.
*   **Level 0 (Base):** `surface` (#faf9fb) for the main canvas.
*   **Level 1 (Sections):** `surface_container_low` (#f4f3f5) for background grouping of related cards.
*   **Level 2 (Active Elements):** `surface_container_lowest` (#ffffff) for primary cards and input fields to give them a "lifted" appearance.

### The "Glass & Gradient" Rule
For hero sections and primary CTAs, use subtle gradients transitioning from `primary` (#b52330) to `primary_container` (#ff5a5f). For floating navigation or modal overlays, apply **Glassmorphism**: use `surface` at 80% opacity with a `20px` backdrop-blur to maintain a sense of environmental depth.

## 3. Typography: The Editorial Voice

We utilize a dual-font strategy to balance character with readability.

*   **Lexend (Headlines & Display):** Chosen for its hyper-friendly, geometric clarity. Use `display-lg` (3.5rem) for hero moments to establish an immediate, premium presence.
*   **Inter (Body & Labels):** The workhorse. Inter provides the technical precision required for dense information areas, ensuring that search results and UI labels remain legible at all sizes.

**Hierarchy as Identity:**
By dramatically scaling the difference between `headline-lg` and `body-md`, we create a "Search-First" hierarchy where the user's intent (the headline) is the hero, and the interface (the labels) recedes until needed.

## 4. Elevation & Depth

### Tonal Layering
Depth is achieved by stacking. A `surface_container_lowest` card placed on a `surface_container_low` background creates a natural, soft separation. This "low-contrast" layering is the hallmark of a premium experience.

### Ambient Shadows
For floating elements (like the primary search bar), use "Ambient Shadows":
*   **Blur:** 40px - 60px
*   **Opacity:** 4% - 8%
*   **Tint:** Use a tinted version of `on_surface` (deep charcoal) mixed with `secondary` indigo to mimic natural light refraction rather than a dead grey shadow.

### Ghost Borders
If a border is required for accessibility (e.g., input states), use the **Ghost Border**: `outline_variant` (#e2bebc) at 20% opacity. Never use 100% opaque borders.

## 5. Components

### Search Bar (The System Anchor)
*   **Corner Radius:** `full` (9999px) or `xl` (3rem).
*   **Elevation:** Level 3 Ambient Shadow.
*   **Interaction:** On focus, the shadow expands, and the `outline` becomes a soft glow of `secondary_fixed_dim`.

### Primary Buttons
*   **Style:** Subtle gradient from `primary` to `primary_container`.
*   **Padding:** `spacing-3` (top/bottom) and `spacing-6` (left/right).
*   **Corner Radius:** `DEFAULT` (1rem/16px) or `full` for a friendlier feel.

### Cards & Result Lists
*   **Rule:** Forbid divider lines. 
*   **Separation:** Use `spacing-5` or `spacing-6` vertical white space to separate content blocks.
*   **Surface:** Use `surface_container_lowest` for cards to make them pop against the `surface` background.

### Chips (Category Filters)
*   **Style:** Pill-shaped (`full`).
*   **Color:** `surface_container_high` with `on_surface_variant` text.
*   **Active State:** Transitions to `secondary` with `on_secondary` text.

### Input Fields
*   **Background:** `surface_container_highest` (#e3e2e4) at 50% opacity.
*   **Transitions:** Smooth 200ms ease-in-out for focus states, removing the background and replacing it with a `surface_container_lowest` fill and a Ghost Border.

## 6. Do's and Don'ts

### Do:
*   **Do** embrace extreme white space. If a layout feels "empty," it's often working.
*   **Do** use `Lexend` for any text larger than 24px to emphasize the brand's friendly personality.
*   **Do** use the `1.7rem (spacing-5)` as your default "breathing room" between major UI clusters.

### Don't:
*   **Don't** use pure black (#000000) for text. Use `on_surface` (#1a1c1d) to maintain a soft, premium feel.
*   **Don't** use standard "Drop Shadows" from software defaults. Always customize with high blur and low opacity.
*   **Don't** use borders to create "boxes." Let the background colors and typography alignment define the structure.
*   **Don't** cram icons into every button. Let the typography and color do the heavy lifting.