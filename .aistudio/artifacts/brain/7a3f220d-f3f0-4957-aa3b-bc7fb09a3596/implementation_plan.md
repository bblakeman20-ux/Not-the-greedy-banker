# Pass-Through Pill Styling, Compact Header Logo Lockup & Bespoke Vector Iconography

Refine the application's visual polish by implementing a horizontal logo-and-title lockup that eliminates dead space, redesigning the two-tier mode pills with solid hot-coral pass-through stencil styling, and replacing all emojis across the entire UI with minimalist Lucide vector outline icons in matching theme colors.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following two choices in Phase 1:
> 1. **Pass-Through Pill Styling**: Solid hot-coral pill (`#ff6b57`) with dark background cutout text and icon, creating a bold, high-contrast stencil effect when active.
> 2. **Vector Icon Set**: Minimalist Lucide vector outline icons in matching theme colors (replacing all emojis across header, tabs, parameters, discovery pills, and shortlist cards).

- **Confirmed Decision 1**: The large flagship pill will read cleanly as **`Pintdr mode`** with a minimalist `Flame` icon. When active, it displays a solid hot coral fill (`bg-[#ff6b57]`) with dark container background cutout text and icon (`text-[#17171a]`). The 3 sub-pills (`Interactive Map`, `Gerg AI`, `Pitch Custom`) follow the same pass-through stencil design when active.
- **Confirmed Decision 2**: The top header title **Pintdr** and subline **squad outing matcher** sit directly adjacent to the pint logo in a horizontal layout (`flex items-center gap-3.5`), color-matched to the app's hot coral theme (`#ff6b57`), eliminating the vertical dead space.
- **Confirmed Decision 3**: Complete emoji eradication across the app—all emojis in tabs (`🎯 Activities`, `📅 Dates`, `🚆 Travel`, `💷 Kitty`), parameters, mode chips, voting buttons, and shortlist cards are replaced with crisp, bespoke Lucide vector outline icons.

---

## 1. Overview & Core Concept

- **What It Does**:
  - Replaces the vertically stacked logo and header text with an integrated horizontal lockup where the "Pintdr" title and "squad outing matcher" subtitle sit cleanly to the right of the pint glass mark in the brand's hot coral color.
  - Updates the flagship PINTDR mode pill to say strictly `Pintdr mode` with a simple flame icon using a solid hot-coral pass-through stencil effect, and applies the same unified design language to the three mode pills below.
  - Converts every remaining emoji across navigation tabs, search inputs, AI mode buttons, shortlist actions, and bounty banners into uniform, theme-colored vector icons.
- **Target Audience**: Squad members seeking a sleek, modern, professional web app that feels like a bespoke product rather than a casual toy.
- **Key Value**: Crisp typographic hierarchy, purposeful color theory with pass-through button depth, and cohesive iconography without generic or amateur emojis.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Header & Brand Presence**:
   - The user opens the app and sees the pint logo icon seamlessly paired side-by-side with the hot coral `Pintdr` title and `squad outing matcher` subtitle on the left.
   - Action controls (`QR Join`, `Rooms & Setup`, `Dark/Light`) sit compactly on the right with uniform vector icons (`QrCode`, `Settings`, `Sun`/`Moon`).
2. **Flagship Mode Selector**:
   - In the idea discovery section, the user sees the prominent Tier 1 pill: `Pintdr mode` with a simple `Flame` icon.
   - When active, it fills with solid hot coral (`#ff6b57`), and the icon and text are styled in the dark container surface color (`#17171a`), producing a clean cutout stencil appearance.
   - Tier 2 sits directly underneath with 3 pills of equal 1/3 width:
     - `Interactive Map` with a minimalist `Map` icon.
     - `Gerg AI` with a minimalist `Sparkles` icon.
     - `Pitch Custom` with a minimalist `PenTool` or `Plus` icon.
   - When any Tier 2 pill is active, it takes the pass-through stencil styling in its designated theme accent.
3. **Bespoke Vector Iconography Across the App**:
   - **Navigation Tabs**: `Target` (Activities), `Calendar` (Dates), `Train` (Travel), `Coins` (Kitty).
   - **Parameter Fields**: `Compass` (Parameters), `MapPin` (Where), `Sparkles` (Vibe), `Clock` (When), `PoundSterling` (Budget).
   - **Voting & Shortlist**: `ThumbsUp` (Keen), `ThumbsDown` (Veto), `Star` (Winner), `Ban` (Ban List), `Dices` (Roll Spots), `Home` (Host Outing).

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Why | Rejected Alternatives |
| :--- | :--- | :--- | :--- |
| **Pass-Through Pill Styling** | Solid hot-coral background with `#17171a` cutout text and icon | Delivers immediate visual weight, crisp contrast, and a distinct stencil tactile feel without blurry outer glows. | Outlined pill with colored text (blends into dark cards) or multicolor gradients. |
| **Header Logo Alignment** | Horizontal lockup (`flex items-center gap-3.5`) | Eliminates vertical dead space and creates a balanced, compact header row on mobile and desktop. | Stacking title under the logo (wasted 40px+ of vertical screen space). |
| **Iconography Standard** | Lucide React outline icons with uniform stroke-width (1.75px) | Ensures visual cohesion, crisp rendering at all DPIs, and professional aesthetic without emoji rendering discrepancies across Android/iOS/Desktop. | Retaining Unicode emojis (looks amateur and inconsistent across platforms). |

---

## 4. Technical Architecture & Component Mapping

### Component Modification Scope

```
┌─────────────────────────────────────────────────────────────┐
│                    App Layout & Navigation                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Header.tsx & PintdrLogo.tsx                           │  │
│  │ [Logo Box] ──► [ Pintdr (Coral) / squad matcher ]     │  │
│  │ (Horizontal lockup, no dead space, theme matched)     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ App.tsx: Navigation Tabs                              │  │
│  │ [ <Target/> Activities ]  [ <Calendar/> Dates ]       │  │
│  │ [ <Train/> Travel ]       [ <Coins/> Kitty ]          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ActivitiesTab.tsx: Two-Tier Pass-Through Pills        │  │
│  │ Tier 1: [ 🔥 Pintdr mode (Solid Coral + Cutout Text) ]│  │
│  │ Tier 2: [ 🗺️ Map ]   [ ✨ Gerg AI ]   [ ✏️ Pitch ]    │  │
│  │                                                       │  │
│  │ Replaced all emojis in parameters, votes & bounties:  │  │
│  │ • MapPin, Sparkles, Clock, PoundSterling              │  │
│  │ • ThumbsUp, ThumbsDown, Trophy, Ban, Dices, Home      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Implementation Steps

1. **Update `src/components/PintdrLogo.tsx` & `src/components/Header.tsx`**:
   - Change `PintdrLogo` default orientation to `'horizontal'` with `items-center gap-3.5`.
   - Update "Pintdr" brand title color to hot coral (`#ff6b57`) with subtle warm contrast, color-matched to the app flame theme.
   - Adjust icon container size to a compact `w-14 h-14` or `w-12 h-12` so the entire header is balanced and slim.
2. **Refactor Two-Tier Pills in `src/components/Tabs/ActivitiesTab.tsx`**:
   - Change label to strictly `Pintdr mode`.
   - Render `Flame` Lucide icon.
   - Implement pass-through styling:
     - Active: `bg-[#ff6b57] text-[#17171a] font-extrabold shadow-md`.
     - Inactive: `bg-[#212124] text-[#f4f4f5] border border-[#ff6b57]/30 hover:border-[#ff6b57]`.
   - Apply pass-through logic to the 3 sub-pills (`Map`, `Gerg AI`, `Pitch Custom`).
3. **Replace All Emojis with Lucide Vector Icons**:
   - In `src/App.tsx`: Navigation tab labels, room status, empty states.
   - In `src/components/Tabs/ActivitiesTab.tsx`: Shared parameters, Gerg AI modes, roulette, shortlist cards, Keen/Veto buttons, and ban list.
   - In `src/components/ProfileBar.tsx` / `ProfileModal.tsx`: User profile avatar fallbacks with clean geometric badges.
4. **Verification**:
   - Run `lint_applet` and `compile_applet` to verify clean build with zero TypeScript errors.
