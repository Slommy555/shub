# UI_SKILL.md — App Design System

Read this file before building or modifying ANY UI component, screen, or layout in this project. Every visual decision must follow this system. Do not default to generic Tailwind styles, shadcn defaults, or any other component library's default appearance — always derive from this design system first.

---

## AESTHETIC DIRECTION

The app uses a dark, premium mobile-first aesthetic. Think: deep space, soft glow, quiet luxury. The background is near-black with a subtle purple undertone. Content lives in elevated dark cards. The single accent color is soft lavender/purple — used sparingly for CTAs, active states, and highlights. Everything else is dark, muted, and restrained.

The UI should feel calm and focused — like a tool a serious person uses every day, not a flashy consumer app.

---

## COLOR SYSTEM

Use these exact values consistently. Never substitute with generic Tailwind color classes like bg-gray-900 or text-purple-400 — always use the custom tokens below via CSS variables or Tailwind config.

### Dark Mode (default — this app is primarily dark)
```
--color-bg-base:        #16161f   /* deepest background, page/screen root */
--color-bg-elevated:    #1e1e2e   /* card backgrounds, modals, sheets */
--color-bg-surface:     #252538   /* inputs, secondary cards, hover states */
--color-bg-overlay:     #2d2d45   /* tooltips, dropdowns, popovers */

--color-accent:         #b8a9f5   /* primary lavender accent — buttons, active tabs, highlights */
--color-accent-muted:   #7c6fb0   /* secondary accent — borders, inactive indicators */
--color-accent-subtle:  #2a2545   /* very subtle accent tint — selected row backgrounds */

--color-text-primary:   #f0eeff   /* primary text — slightly warm white, not pure #fff */
--color-text-secondary: #8b8aa8   /* secondary text — muted purple-gray */
--color-text-tertiary:  #56556a   /* placeholder text, disabled states */

--color-border:         #2e2e45   /* card borders, dividers — barely visible */
--color-border-strong:  #3d3d5c   /* stronger borders for inputs and focused elements */

--color-success:        #4caf82   /* green — completion states, positive values */
--color-warning:        #f0a04b   /* amber — warnings, approaching limits */
--color-danger:         #e05c5c   /* red — errors, conflicts, over-budget, delete actions */
--color-info:           #5c9eff   /* blue — informational badges */
```

### Light Mode (when user switches)
```
--color-bg-base:        #f4f3ff
--color-bg-elevated:    #ffffff
--color-bg-surface:     #eeecff
--color-bg-overlay:     #e8e6ff
--color-accent:         #7c6fb0
--color-accent-muted:   #b8a9f5
--color-accent-subtle:  #ede9ff
--color-text-primary:   #1a1830
--color-text-secondary: #6b6888
--color-text-tertiary:  #a09db8
--color-border:         #e0ddf5
--color-border-strong:  #c8c4e8
```

---

## TYPOGRAPHY

Font stack: system UI first, no external font imports unless the project already has one configured.
```
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
```

### Type Scale
```
--text-xs:    11px / line-height: 1.4  /* timestamps, badges, captions */
--text-sm:    13px / line-height: 1.5  /* secondary labels, meta info */
--text-base:  15px / line-height: 1.6  /* body text, list items, inputs */
--text-md:    17px / line-height: 1.5  /* primary list item text */
--text-lg:    20px / line-height: 1.4  /* section headers, card titles */
--text-xl:    24px / line-height: 1.3  /* screen titles */
--text-2xl:   32px / line-height: 1.2  /* hero numbers, large display */
--text-3xl:   48px / line-height: 1.1  /* dashboard big stats */
```

### Font Weights
- **400** — body, secondary text
- **500** — list item primary text, input values, labels
- **600** — section headers, card titles, button text
- **700** — screen titles, hero numbers only

### Rules
- Never use font-weight 800 or 900
- Letter spacing: -0.02em on headings/titles, 0 on body, +0.04em on ALL CAPS labels/badges
- Line clamp task/note text at 2 lines in list views — show full text only in expanded/detail view
- Numbers in dashboards and stats: use tabular-nums for alignment

---

## SPACING SYSTEM

Base unit: 4px. All spacing is a multiple of 4.
```
4px   — xs  (icon gaps, tight inline spacing)
8px   — sm  (within-component spacing, badge padding)
12px  — md  (between related elements)
16px  — lg  (standard card padding, section gaps)
20px  — xl  (generous card padding on larger cards)
24px  — 2xl (between sections)
32px  — 3xl (major section breaks, screen-level padding)
```

Screen horizontal padding: 16px on mobile, 24px on desktop.
Card internal padding: 16px all sides (mobile), 20px all sides (desktop).

---

## BORDER RADIUS

This design uses heavy rounding throughout. Anything that looks like a rectangle should feel soft.
```
--radius-sm:    8px    /* badges, chips, small tags */
--radius-md:    12px   /* inputs, small cards, buttons (height < 44px) */
--radius-lg:    16px   /* standard cards, modals, sheets */
--radius-xl:    20px   /* large feature cards, bottom sheets */
--radius-full:  9999px /* pills, toggles, FABs, avatar circles */
```

Never use border-radius less than 8px except for dividers and progress bars (use 4px for those).

---

## ELEVATION / SHADOW

Cards and modals use subtle shadow, never harsh drop shadows.
```
--shadow-card:   0 2px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--color-border);
--shadow-modal:  0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border-strong);
--shadow-fab:    0 4px 16px rgba(184, 169, 245, 0.25); /* accent glow for FABs */
```

Use border (1px solid --color-border) on all cards — the border matters more than the shadow for definition on dark backgrounds.

---

## COMPONENT PATTERNS

### Cards
- Background: --color-bg-elevated
- Border: 1px solid --color-border
- Border radius: --radius-lg (16px)
- Padding: 16px
- No external shadow on flat list cards — only on modals and floating elements
- Hover/press state: background shifts to --color-bg-surface (subtle, not dramatic)

### Buttons — Primary (CTA)
- Background: --color-accent (#b8a9f5)
- Text: #16161f (dark, not white — provides contrast on the lavender)
- Font weight: 600
- Border radius: --radius-full (pill shape)
- Height: 52px on mobile, 44px on desktop
- Width: full width for primary actions, auto for secondary
- No border
- Press state: opacity 0.85, slight scale(0.98)
- Never use more than one primary button per screen section

### Buttons — Secondary
- Background: --color-bg-surface
- Text: --color-text-primary
- Border: 1px solid --color-border-strong
- Same radius and height as primary
- Press state: background shifts to --color-bg-overlay

### Buttons — Destructive
- Background: transparent
- Text: --color-danger
- Border: 1px solid --color-danger at 40% opacity
- Only used for delete/remove actions

### Inputs / Text Fields
- Background: --color-bg-surface
- Border: 1px solid --color-border
- Focused border: 1px solid --color-accent-muted
- Text: --color-text-primary
- Placeholder: --color-text-tertiary
- Border radius: --radius-md (12px)
- Height: 48px (single line), auto (multiline)
- Padding: 12px 16px
- No label above input by default — use placeholder as label for simple forms, floating label for complex forms

### Checkboxes / Completion Toggles
- Unchecked: circle outline, 22px diameter, border --color-border-strong
- Checked: filled circle with --color-accent, white checkmark icon inside
- Tap target: minimum 44x44px regardless of visual size
- Transition: 150ms ease on fill

### Category / Status Badges
- Height: 22px
- Padding: 4px 10px
- Border radius: --radius-full
- Font size: 11px, font weight: 500, letter-spacing: +0.02em
- Color variants (background / text):
  - Work:     #1a2a4a / #5c9eff
  - Personal: #2a1a45 / #b8a9f5
  - School:   #1a2e1a / #4caf82
  - Health:   #1a2e28 / #4caf82
  - Other:    #252538 / #8b8aa8
  - High:     #3a1a1a / #e05c5c
  - Medium:   #2e2010 / #f0a04b
  - Low:      #1a2e20 / #4caf82

### Priority Dots
- 8px diameter circle, no border
- High: --color-danger
- Medium: --color-warning
- Low: --color-success
- Positioned inline left of task text or in a dedicated column

### Navigation — Bottom Tab Bar
- Background: --color-bg-elevated with top border --color-border
- Height: 56px + safe area inset bottom
- Active tab: icon and label in --color-accent
- Inactive tab: icon and label in --color-text-tertiary
- Active indicator: small dot or underline in --color-accent below active icon, not a full background pill
- Tab labels: 10px, font-weight 500

### Floating Action Button (FAB)
- Size: 56px diameter circle
- Background: --color-accent
- Icon: dark (#16161f), 24px
- Shadow: --shadow-fab (accent glow)
- Position: fixed bottom right, above tab bar + 16px gap
- On mobile: accounts for safe area inset bottom

### Modals / Bottom Sheets
- Background: --color-bg-elevated
- Top border radius: --radius-xl (20px) for bottom sheets, --radius-lg for centered modals
- Drag handle at top of bottom sheets: 4px × 36px, --color-bg-overlay, border-radius 2px, centered
- Backdrop: rgba(0,0,0,0.6) blur(4px)
- Animation: slide up from bottom (300ms ease-out) for sheets, fade+scale (200ms) for centered modals

### Dividers / Separators
- Height: 1px
- Color: --color-border
- No margin collapse — always explicit margin-top and margin-bottom
- Never use hr — use a div with explicit styling

### Progress Bars
- Track: --color-bg-surface, height 6px, border-radius 4px
- Fill: --color-accent, same height and radius
- Overflow hidden on track

### Skeleton Loaders
- Background: --color-bg-surface
- Animated shimmer: linear-gradient from --color-bg-surface to --color-bg-overlay and back
- Animation: 1.5s ease-in-out infinite
- Match the shape of the content they replace exactly

---

## LAYOUT PATTERNS

### Screen Structure (Mobile)
```
[Status bar safe area]
[Screen header — 56px]
  [Back arrow OR hamburger] [Title — text-xl, weight 600] [Right action]
[Sub-navigation if needed — 44px, horizontal scroll pills]
[Main scroll content — flex 1, overflow-y auto]
  [16px horizontal padding]
  [Content sections with 24px gap between them]
[Bottom tab bar]
[Safe area inset bottom]
```

### Screen Structure (Desktop)
```
[Top nav bar — 64px]
[Sidebar — 240px fixed left] | [Main content — flex 1]
  [24px padding all sides]
  [Max content width: 800px, centered if wider]
```

### List Items
- Minimum height: 64px
- Consistent left padding: 16px
- Content left-aligned, meta/actions right-aligned
- Chevron (→) only on items that navigate somewhere — never on toggleable items
- Swipe-to-delete reveals red delete button from right edge

### Section Headers in Lists
- Text: --color-text-secondary, text-sm (13px), font-weight 500, ALL CAPS, letter-spacing +0.08em
- Margin bottom: 8px
- No background — flush with the list

### Empty States
- Centered vertically and horizontally in the content area
- Simple icon (outline style, 48px, --color-text-tertiary)
- Title: text-md, --color-text-secondary
- Subtitle: text-sm, --color-text-tertiary, max 2 lines
- CTA button if applicable (primary style)
- No illustrations with color — keep it monochrome and simple

---

## ANIMATION / MOTION

Keep motion purposeful and fast. This app is a tool, not an experience.

```
transition-fast:    100ms ease        /* hover states, color changes */
transition-normal:  200ms ease        /* opacity, small transforms */
transition-enter:   300ms ease-out    /* elements entering the screen */
transition-exit:    200ms ease-in     /* elements leaving */
```

- Checkboxes: 150ms fill animation
- Card expand/collapse: 250ms height animation with opacity
- Bottom sheet open: 300ms slide up
- Tab switches: instant (no crossfade — feels sluggish)
- List item swipe: follow finger directly, no animation until release
- Completed task: 200ms strikethrough + fade to 45% opacity, then reorder with 300ms translate
- Never animate layout shifts that the user didn't trigger

Respect `prefers-reduced-motion` — wrap all non-essential animations in a media query check.

---

## ICONOGRAPHY

- Use Lucide React icons (already common in React projects) or Heroicons — outline style only
- Size: 20px for inline/list icons, 24px for nav and FAB icons, 16px for badge/chip icons
- Color: inherit from parent text color — never hardcode icon colors separately from their context
- Stroke width: 1.5px (Lucide default is fine)
- Never mix icon libraries within a single view

---

## SPECIFIC COMPONENT RULES

### Task Cards
- Left edge: 3px colored strip indicating priority (red/amber/green) — subtler than a full badge
- Checkbox on far left, 44px tap target
- Task text: text-md (17px), weight 500
- Meta row below text: category badge + priority dot + due date chip — all in one line, wraps if needed
- Expand arrow on far right (rotates 180° when expanded)
- Completed state: 45% opacity, strikethrough on text, priority strip becomes --color-bg-surface

### Habit Cards
- Full width, 64px minimum height
- Left: large circle checkbox (28px visual, 44px tap target)
- Center: habit name text-md weight 500
- Right: streak count if applicable (text-sm, --color-accent)
- Completed: checkbox fills with --color-accent, name gets --color-text-secondary color

### Workout Set Rows
- Table-like layout: Set # | Weight | Reps | RPE (if enabled) | Checkbox
- Compact: 44px row height
- Checkbox: 28px visual size, 44px tap target
- Completed set row: background shifts to --color-accent-subtle, text muted
- Completed exercise block: entire block at 40% opacity, moves to bottom of list

### Budget Transaction Rows
- Left: category color dot (10px) + category name
- Center: description text
- Right: amount — green for income, red for expense, accent for savings
- Swipe left reveals red delete button

### Notes
- Title: text-xl, weight 600, --color-text-primary
- Body: text-base, weight 400, --color-text-primary, line-height 1.7
- Page/folder indicator: small pill badge top of note, --color-accent-subtle background

---

## WHAT TO AVOID

- Never use pure white (#ffffff) as a background — always the tinted dark values above
- Never use pure black (#000000) anywhere
- Never use generic Tailwind blue (blue-500, blue-600 etc.) — use the accent lavender instead
- Never use box-shadow with a colored shadow unless it's the accent glow on FABs
- Never stack more than 2 levels of card nesting (card inside card inside card = too deep)
- Never use font-size below 11px
- Never put more than 3 actions on a single card — use a ... overflow menu if needed
- Never use a tab bar with more than 5 tabs
- Never use ALL CAPS for anything longer than 3 words
- Never center-align body text or list content — left-align always
- Never use a border-radius below 8px on interactive elements

---

## APPLYING THIS SKILL

When Claude Code reads this file, it must:
1. Derive ALL colors from the token system above — no ad-hoc color choices
2. Apply the border radius values consistently — no sharp corners on cards or buttons
3. Use the typography scale — no arbitrary font sizes
4. Follow the component patterns exactly for any component type listed above
5. For any component NOT listed above: extrapolate from the principles (dark elevated background, lavender accent, heavy rounding, restrained decoration)
6. When in doubt: add more spacing, reduce visual weight, and remove decorative elements
