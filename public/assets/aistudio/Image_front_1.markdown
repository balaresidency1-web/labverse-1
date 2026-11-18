---
name: Precision Scientific Pedagogy
colors:
  surface: '#faf8ff'
  surface-dim: '#cfd9fc'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2ff'
  on-surface: '#101b35'
  on-surface-variant: '#444654'
  inverse-surface: '#25304b'
  inverse-on-surface: '#eef0ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2c51d5'
  primary: '#063ac1'
  on-primary: '#ffffff'
  primary-container: '#3155d9'
  on-primary-container: '#d7dcff'
  inverse-primary: '#b8c4ff'
  secondary: '#5946c9'
  on-secondary: '#ffffff'
  secondary-container: '#7260e4'
  on-secondary-container: '#fffbff'
  tertiary: '#00525e'
  on-tertiary: '#ffffff'
  tertiary-container: '#006c7b'
  on-tertiary-container: '#92ecff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001354'
  on-primary-fixed-variant: '#0036bb'
  secondary-fixed: '#e5deff'
  secondary-fixed-dim: '#c7bfff'
  on-secondary-fixed: '#180065'
  on-secondary-fixed-variant: '#432cb3'
  tertiary-fixed: '#a3eeff'
  tertiary-fixed-dim: '#53d7f0'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#faf8ff'
  on-background: '#101b35'
  surface-variant: '#dae2ff'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.375rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.625rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

The design system establishes a high-performance academic environment bridging empirical rigor with cutting-edge software craft. Designed for university researchers, STEM students, and lab directors, the interface projects clinical authority, focused immersion, and structural clarity. The visual language strips away frivolous decoration in favor of typographic exactitude, crisp architectural boundaries, and purposeful kinetic feedback.

Drawing inspiration from linear developer ergonomics and virtual simulation consoles, the design language balances institutional trust with high-density utility. Layouts feature structured canvas framing, dedicated viewport containment for virtual apparatuses, and meticulous telemetry indicators. Visual weight is used systematically to separate navigation, workbench parameters, and analytical results without cluttering cognitive bandwidth.

## Colors

The palette operates on a calibrated taxonomy of surface contrasts, action anchors, and diagnostic signals:

- **Canvas & Structural Foundations:** The application canvas runs on a softened cool base (`#F5F7FC`), setting elevated white workspaces (`#FFFFFF`) in immediate spatial relief. Persistent navigational frames, collapsibles, and high-level role manifests leverage Deep Navy (`#101B35`) to ground operational workflows.
- **Action & Accent Hierarchy:** Royal Blue (`#3155D9`) anchors primary interactive targets, verified steps, and high-priority execution paths. Electric Indigo (`#6856D9`) handles exploratory interactions, secondary toggles, and state transitions. Cyan (`#26B9D1`) is reserved for dynamic telemetry: active simulation states, digital calipers, real-time readouts, and interactive progress scrubbers.
- **Diagnostic Semantics:** The system deploys an isolated tri-color semantic engine: Emerald (`#168A62`) for validated states and faculty sign-offs, Amber (`#D99022`) for protocol exceptions and pending verification tiers, and Crimson (`#D64A55`) for specimen hazards, expired reagents, and parameter bounds violations.
- **Text & Contrast System:** Structural copy uses High-Contrast Slate (`#202A3A`) for non-negotiable optical readability. Secondary metadata, apparatus labels, and inactive table parameters adopt Neutral Steel (`#68758A`).

## Typography

The typographic scale uses a dual-engine structure: **Plus Jakarta Sans** governs architectural displays and module titles to deliver geometric refinement and approachability, while **Inter** commands all informational, mechanical, and tabular structures. 

Tabular figures (`tnum`) must be enforced on numerical metrics, time logs, and virtual instrumentation readouts. Micro-labels (`label-sm`, `label-md`) utilize deliberate tracking (`0.02em` to `0.04em`) and uppercase transformation for clear distinction within compact laboratory tables and multi-phase procedure rails.

## Layout & Spacing

The layout is engineered around an asymmetric fluid workbench. It features a persistent primary navigation shell (docked at 260px desktop width, collapsible to 64px iconographic mode), flanked by a 12-column adaptive operational grid with a fixed 1600px maximum frame containment.

- **Desktop (1200px+):** 12-column layout with 1.25rem gutters and 2rem outer margins. When the virtual laboratory simulation mode triggers, the viewport partitions into a rigid dual-pane: a 7-column real-time WebGL/Canvas stage paired with a 5-column protocol checklist and telemetry inspector.
- **Tablet (768px - 1199px):** 8-column layout. The primary navigation collapses to an icon bar. Toolbars stack above the telemetry pane.
- **Mobile (<768px):** 4-column layout with 0.75rem gutters and 1rem canvas margins. Simulation workspaces auto-orient or require landscape triggers, while protocol steps switch to vertical swiping card stacks.

## Elevation & Depth

Visual hierarchy uses architectural surface contrast rather than deep drop shadows. All surfaces interact within a structured three-tier depth model:

1. **Base Layer (Canvas):** `#F5F7FC` serves as the canvas substrate upon which cards and boards rest without casting shadows.
2. **Operational Tier (Cards, Modules, Input Groups):** `#FFFFFF` surfaces bounded by an invariant hairline boundary: `1px solid #E2E8F0`. Depth is conveyed through an ultra-soft atmospheric shadow: `box-shadow: 0 1px 3px 0 rgba(16, 27, 53, 0.05), 0 1px 2px -1px rgba(16, 27, 53, 0.02)`.
3. **Elevated & Interactive Tier (Flyouts, Active Modals, Hover States):** Hover states and active drag handles elevate slightly using `box-shadow: 0 4px 6px -1px rgba(16, 27, 53, 0.07), 0 2px 4px -2px rgba(16, 27, 53, 0.04)`. Modals, floating formula palettes, and role dropdowns utilize an anchored blur backdrop: `backdrop-filter: blur(8px)` with `background: rgba(255, 255, 255, 0.92)` framed by `1px solid rgba(226, 232, 240, 0.8)`.

## Shapes

The design system adopts a calibrated **Soft** corner architecture (`roundedness: 1`). This provides structural rigor suited for technical data tables while softening the visual fatigue of long research sessions.

- **Inputs, Buttons, Badges, Table Rows:** Default to `0.25rem` (4px).
- **Cards, Canvas Workspaces, Inspector Panels:** Default to `rounded-lg` at `0.5rem` (8px).
- **Simulation Viewports, Modal Dialogs:** Default to `rounded-xl` at `0.75rem` (12px).
- **Status Indicators & Pill Toggles:** Maintain fully circular geometry (`9999px`) to immediately distinguish diagnostic states from actionable rectangles.

## Components

### Buttons & Interactive Controls
- **Primary Action:** Solid Royal Blue (`#3155D9`) fill with crisp `#FFFFFF` typography. Hover transitions to `#2544B8` via a 150ms ease curve. Active states depress `1px` downward. Focus ring is an explicit `2px` ring of Cyan (`#26B9D1`) with `2px` white offset.
- **Secondary Action:** Outlined white surface with `1px solid #E2E8F0`, displaying text in `#202A3A`. Hover brings a tinted surface `#F5F7FC` and a tightened border `#CBD5E1`.
- **Destructive/Critical:** Tinted crimson surface (`#FDF2F2`) with `#D64A55` border and text, shifting to solid crimson fill on deliberate hover.

### Status Badges & Protocol Chips
Badges use high-legibility, low-saturation backgrounds paired with dark text for high visibility in high-stress laboratory environments:
- **Not Started:** `#F1F5F9` background, `#475569` text, `#CBD5E1` border.
- **In Progress:** `#EFF6FF` background, `#2563EB` text, `#BFDBFE` border. Includes a pulsing 6px `#26B9D1` live dot.
- **Self-Confirmed:** `#FAF5FF` background, `#6856D9` text, `#E9D5FF` border.
- **Faculty Verified:** `#ECFDF5` background, `#168A62` text, `#A7F3D0` border accompanied by an inline verified check icon.

### Form Inputs & Telemetry Fields
Inputs feature a `#FFFFFF` baseline, `1px solid #E2E8F0`, and inset padding (`0.5rem 0.75rem`). Active focus transitions the border to `#3155D9` with a subtle glow (`0 0 0 3px rgba(49, 85, 217, 0.15)`). Numerical parameter inputs incorporate right-aligned monospaced unit adornments (e.g., `mL`, `µmol`, `rpm`) set in `#68758A`.

### Tables & Data Registers
Tables utilize strict single-line horizontal dividers (`1px solid #E2E8F0`). Headers are rendered with `label-sm` styling, uppercase `#68758A` text, and `#F8FAFC` background. Table rows support a hover background tint of `#F8FAFC`. High-frequency updates pulse with a brief 300ms Cyan (`#26B9D1`) highlight fade.

### Step Progress Trackers
Linear multi-stage protocol trackers use horizontal segmented bars. Completed stages display solid `#3155D9`, the active stage shows an animated dual-gradient from `#3155D9` to `#26B9D1`, and upcoming stages remain inactive in `#E2E8F0`. Each node contains step titles with contextual micro-labels showing completion percentage or protocol phase numbers.

### Virtual Lab Workspace Framing
Simulation stages are framed within an inset `#101B35` viewport border. Floating HUD controls are anchored with semi-transparent navy backing (`rgba(16, 27, 53, 0.85)`), blur filtering (`backdrop-blur-md`), and `#FFFFFF` typography. Calipers and control points use dynamic Cyan (`#26B9D1`) accents.
