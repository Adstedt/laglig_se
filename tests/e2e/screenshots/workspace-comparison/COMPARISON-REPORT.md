# Public vs Workspace Law Page UX Comparison

## Test Date: 2025-12-25

## Public Law Page (`/lagar/[slug]`)

**Screenshot:** `public-law-forordning-20251574-om-elbilspremie-2025-1574-viewport.png`

### Layout Characteristics:

- **Container:** Centered with max-width ~1280px (4xl)
- **Header:** Public navigation bar with "Lagar", "Produkt", "Priser", "Resurser"
- **Auth State:** Shows "Logga in" and "Kom igång" buttons
- **Breadcrumbs:** `Hem > Lagar > SFS 2025:1574` (links to public routes)
- **Sidebar:** None - full-width centered content
- **Content Width:** Content constrained to ~896px (max-w-4xl) inside container

### Key UI Elements:

1. Amber "Not Yet In Force" banner at top
2. Hero card with law icon, title, badges (Lag, SFS number, Gällande)
3. Metadata card (Departement, Utfärdad date, external links)
4. Law text in styled card container
5. Footer with source attribution

---

## Workspace Law Page (`/browse/lagar/[slug]`)

**Screenshot:** `workspace-login-redirect.png` (requires auth)

### Layout Characteristics (Expected):

- **Container:** Full width minus sidebar (flex layout)
- **Header:** Workspace header with workspace name, user avatar
- **Auth State:** Authenticated user visible
- **Breadcrumbs:** `[Workspace] > Lagar > [document]` (workspace context)
- **Sidebar:** Left sidebar with navigation (Rättskällor accordion)
- **Content Width:** Fills available space after sidebar

### Key Differences:

| Aspect        | Public Page          | Workspace Page              |
| ------------- | -------------------- | --------------------------- |
| Layout        | Centered container   | Full-width with sidebar     |
| Navigation    | Top nav bar          | Left sidebar accordion      |
| Breadcrumbs   | `Hem > Lagar > ...`  | `[Workspace] > Lagar > ...` |
| Header        | Marketing header     | Workspace shell header      |
| Content Links | Link to `/lagar/...` | Link to `/browse/lagar/...` |
| Context       | Anonymous browsing   | Authenticated workspace     |

---

## Catalogue Link Behavior

### Public Catalogue (`/rattskallor/lagar`)

- Links to: `/lagar/[slug]`
- User leaves to public detail page

### Workspace Catalogue (`/browse/lagar`)

- Links to: `/browse/lagar/[slug]`
- User stays in workspace context

---

## Visual Comparison

### Public Page (Centered Layout)

```
┌──────────────────────────────────────────────────┐
│  [Logo]     Nav Menu        [Login] [Get Started]│
├──────────────────────────────────────────────────┤
│                                                  │
│         ┌────────────────────────┐               │
│         │    Hem > Lagar > SFS   │               │
│         │                        │               │
│         │  ┌──────────────────┐  │               │
│         │  │  Law Content     │  │               │
│         │  │  (max-w-4xl)     │  │               │
│         │  └──────────────────┘  │               │
│         │                        │               │
│         └────────────────────────┘               │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Workspace Page (Sidebar Layout)

```
┌──────────────────────────────────────────────────┐
│  [Logo]     [Workspace Name]          [Avatar]   │
├─────────┬────────────────────────────────────────┤
│ SIDEBAR │  [Workspace] > Lagar > [doc]          │
│         │                                        │
│ Rätts-  │  ┌────────────────────────────────┐   │
│ källor  │  │                                │   │
│  ├ Alla │  │    Law Content                 │   │
│  ├ Lagar│  │    (full width)                │   │
│  ├ Rätt │  │                                │   │
│  └ EU   │  │                                │   │
│         │  └────────────────────────────────┘   │
│ Lag-    │                                        │
│ listor  │                                        │
└─────────┴────────────────────────────────────────┘
```

---

## Test Results

- ✅ Public catalogue links verified: `/lagar/...`
- ✅ Public page structure captured
- ⏭️ Workspace tests skipped (requires authentication)
- 📸 Screenshots saved to this directory

## To Run Full Comparison

Set environment variables and run:

```bash
export TEST_USER_EMAIL="your-test-email@example.com"
export TEST_USER_PASSWORD="your-password"
pnpm playwright test workspace-comparison
```
