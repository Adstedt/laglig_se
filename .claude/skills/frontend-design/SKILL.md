---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality using the Laglig design system. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Project Design System

**IMPORTANT**: This project has an established design system. All implementations MUST use these fonts, colors, and utilities. Do not introduce outside fonts or color values — build on top of what exists.

### Fonts

This project uses a two-tier typography system:

1. **Google Sans Flex** — Primary UI/body font. Variable weight (100–900). This is the default `font-sans` in Tailwind.
2. **Safiro Medium** — Premium display/accent font. Use via the `.font-safiro` utility class. Reserved for headlines, hero text, and high-impact typographic moments.

Font stack in Tailwind: `font-sans` maps to `'Google Sans Flex', system-ui, sans-serif`.

**Usage rules**:

- Use `font-sans` (Google Sans Flex) for all body text, UI labels, buttons, and general content.
- Use `font-safiro` for display headings, hero titles, pull quotes, and premium accent typography.
- Exploit Google Sans Flex's full variable weight range (100–900) for typographic hierarchy — thin for subtle labels, bold for emphasis.

### Colors (HSL CSS Variables)

All colors use HSL-based CSS variables via Tailwind. Use Tailwind classes (`bg-primary`, `text-muted-foreground`, etc.) — never hardcode hex/rgb values.

**Light mode palette** (warm, off-white aesthetic):
| Token | Tailwind Class | HSL | Character |
|---|---|---|---|
| `--background` | `bg-background` | 40 20% 98% | Warm off-white |
| `--foreground` | `text-foreground` | 30 10% 10% | Dark warm text |
| `--primary` | `bg-primary` / `text-primary` | 30 15% 12% | Warm near-black |
| `--primary-foreground` | `text-primary-foreground` | 40 20% 98% | Light on primary |
| `--secondary` | `bg-secondary` | 40 15% 95% | Warm light gray |
| `--muted` | `bg-muted` | 40 12% 94% | Soft muted bg |
| `--muted-foreground` | `text-muted-foreground` | 30 8% 45% | Subdued text |
| `--accent` | `bg-accent` | 40 15% 93% | Subtle accent bg |
| `--border` | `border-border` | 35 10% 88% | Warm border |
| `--destructive` | `bg-destructive` | 0 84.2% 60.2% | Red |
| `--card` | `bg-card` | 40 15% 99% | Card surface |
| `--ring` | `ring-ring` | 30 15% 12% | Focus ring |

**Section backgrounds** (for page sections and visual variety):

- `bg-section-warm` — `--section-warm: 45 30% 96%` — Warm cream
- `bg-section-sage` — `--section-sage: 140 25% 95%` — Sage green
- `bg-section-cream` — `--section-cream: 35 40% 97%` — Light cream

**Chart colors** (data visualization):

- `chart-1`: 45 70% 55% (warm yellow)
- `chart-2`: 140 35% 45% (sage green)
- `chart-3`: 30 50% 45% (warm orange)
- `chart-4`: 85 40% 50% (lime green)
- `chart-5`: 25 75% 55% (deep orange)

**Dark mode** is fully supported. All Tailwind semantic classes (`bg-background`, `text-foreground`, etc.) automatically switch. Use `dark:` prefix only when you need explicit dark-mode overrides beyond the token system.

**Design character**: The palette is intentionally warm and understated — cream/off-white backgrounds, warm grays, sage and earth accents. This is a legal-tech product that feels premium and trustworthy, not cold or clinical.

### Existing Utilities & Animations

Use these project utilities rather than reinventing:

**Background effects**:

- `.bg-mesh` — Organic premium gradient mesh
- `.bg-mesh-subtle` — Subtle gradient mesh
- `.bg-radial-fade` — Radial gradient fade
- `.bg-ambient` — Soft ambient glow

**Animations**:

- `.animate-fade-up` — Fade + slide up (0.6s)
- `.animate-fade-up-delay-1` / `-2` / `-3` — Staggered fade-up
- `.animate-float` — Floating effect (6s loop)
- `.animate-pulse-slow` — Slow pulse (4s)
- `.animate-shimmer` — Shimmer loading effect (2s)

**Effects**:

- `.glow` / `.glow-sm` — Box shadow glow (primary color)
- `.text-gradient` — Gradient text
- `.card-hover` — Premium card hover (translateY + shadow)

### Radius

Base radius: `--radius: 0.5rem`. Use Tailwind's `rounded-*` classes.

---

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Commit to a distinct direction: brutally minimal, maximalist chaos, luxury/refined, lo-fi/zine, dark/moody, soft/pastel, editorial/magazine, brutalist/raw, retro-futuristic, handcrafted/artisanal, organic/natural, art deco/geometric, playful/whimsical, industrial/utilitarian, etc. There are infinite varieties to start from and surpass. Use these as inspiration, but the final design should feel singular, with every detail working in service of one cohesive direction.
- **Constraints**: Technical requirements (framework, performance, accessibility). This project uses Next.js, React, Tailwind CSS, and shadcn/ui components.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it vigorously. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity. But always ground the design in the project's warm, premium aesthetic DNA.

Then implement working code (React/TSX with Tailwind) that is:

- Production-grade, functional, and responsive
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail
- Built on the project's design tokens — not fighting them

## Frontend Aesthetics Guidelines

Focus on:

- **Typography**: Use the two-tier font system. **Safiro** (`.font-safiro`) for display type — headlines, hero sections, premium moments. **Google Sans Flex** (`font-sans`) for everything else, exploiting its variable weight range for hierarchy. Work the full typographic range: size, weight, case, spacing. Pair Safiro's editorial elegance with Google Sans Flex's clean utility.
- **Color & Theme**: Build on the warm HSL palette. The project's identity is warm off-whites, earthy accents, and sage greens. Push the palette creatively — use section backgrounds for rhythm, chart colors for pops of vibrancy, and the muted tokens for depth. Lead with the warm primary, punctuate with destructive red or chart accents when needed.
- **Motion**: Use the project's existing animation utilities (`.animate-fade-up`, `.animate-float`, etc.) as a foundation. Add custom animations when the existing set doesn't cover the need. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: orchestrated page loads with staggered `.animate-fade-up-delay-*` creates delight. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap and z-depth. Diagonal flow. Grid-breaking elements. Dramatic scale jumps. Full-bleed moments. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Use `.bg-mesh`, `.bg-ambient`, `.bg-radial-fade` for atmospheric depth. Layer with section backgrounds (`.bg-section-warm`, `.bg-section-sage`, `.bg-section-cream`) for visual rhythm. Apply `.glow` / `.glow-sm` for interactive emphasis. Add contextual effects that match the warm, premium aesthetic. Use `.text-gradient` and `.card-hover` for interactive polish.

NEVER introduce outside font families — this project has specific typography. NEVER hardcode color values — use the CSS variable system via Tailwind classes. NEVER use generic AI aesthetics like overused gradients-on-white, cliched layouts, or cookie-cutter component patterns.

INSTEAD: Use Safiro + Google Sans Flex pairing expressively. Push the warm palette creatively. Build on existing utilities. Make layouts that surprise while respecting the design system.

Build creatively on the user's intent, and make unexpected choices that feel genuinely designed for the context. Every design should feel distinct. Actively explore the full range: leverage the warm/sage/cream section backgrounds, the chart accent colors, and the premium animation utilities. Let the specific context drive choices.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, elegance, and precision. All designs need careful attention to spacing, typography, and subtle details. Excellence comes from executing the vision well.

Remember: Claude is capable of extraordinary, award-worthy creative work. Don't hold back, show what's truly possible, and commit relentlessly to a distinctive and unforgettable vision — grounded in this project's warm, premium identity.
