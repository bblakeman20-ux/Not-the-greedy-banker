# Modern Gemini Model Migration (gemini-flash-latest & Gemini 3 Family)

Upgrade the entire Gemini engine configuration to default to `gemini-flash-latest` with current Gemini 3 series fallbacks (`gemini-3.8-flash` and `gemini-3.1-flash-lite`), while actively purging deprecated legacy models (1.5/2.0/2.5) across state storage and UI selectors.

### User Review & Critical Decisions

> [!IMPORTANT]
> The confirmed choices from your clarification answers have been incorporated into this plan:

- **Confirmed Model Default**: `gemini-flash-latest` is set as the primary default model across initial loads, new rooms, and the Setup modal, ensuring the app continuously tracks the latest Flash production release.
- **Confirmed Fallback Architecture**: All fallback arrays, dynamic model sorting regexes, and backup chains are modernized to Gemini 3 (`gemini-3.8-flash` and `gemini-3.1-flash-lite`). Deprecated models (`gemini-1.5-*`, `gemini-2.0-*`, and `gemini-2.5-*`) are completely retired.
- **Automatic Legacy Migration**: Stored browser cache/localStorage values referencing obsolete models are automatically sanitized and upgraded to `gemini-flash-latest` on app mount.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades Gerg AI generation to use `gemini-flash-latest` as the primary engine. In case of localized rate limits or network issues, the fallback pipeline cascades smoothly to `gemini-3.8-flash` and `gemini-3.1-flash-lite`.
- **Target Audience / Persona**: Squad members organizing outings who require instantaneous, creative venue and activity suggestions with real-time SSE token streaming and live search verification.
- **Key Value**: Guarantees peak speed, freshness, and adherence to the latest Google Gemini platform capabilities with zero lag or legacy model errors.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **One-Tap Generation**: User taps "Gerg AI" or "🎲 Pintdr" in the Activities tab. Requests immediately stream from `gemini-flash-latest` with sub-second time-to-first-card.
  2. **Model Transparency**: The status ticker and completion pill display the exact active model (e.g., `⚡ Gerg AI delivered 3 ideas in 1.4s (via gemini-flash-latest)`).
  3. **Setup Modal Management**: When opening Backend & Room Sync (Setup), the model input suggests `gemini-flash-latest` as standard, with quick-select pills for `gemini-3.8-flash` and `gemini-3.1-flash-lite`.
- **Visual Identity & Theme**:
  - Maintains the existing dark graphite aesthetic (`#17171a`, `#212124`) with warm neon accents (`#ff6b57` Coral, `#c6ff3d` Lime for speed metrics).
  - Clean monospace typography for model identifiers and latency stats.
- **Interactive Feedback & Motion**:
  - Live token streaming ticker with incremental JSON decoding keeps cards flowing without waiting for the full response.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Model Hierarchy & Fallbacks**
  - *Chosen Approach*: `gemini-flash-latest` (Primary) → `gemini-3.8-flash` (First Backup) → `gemini-3.1-flash-lite` (High-Throughput Backup).
  - *Why*: Provides the ideal balance between tracking the newest features while guaranteeing robust, tested fallbacks if an API quota is reached.
  - *Alternatives Considered*: Legacy 2.5/1.5 models were discarded because they are deprecated and prohibited under current guidelines.
- **Decision 2: Thinking & Latency Optimization**
  - *Chosen Approach*: Enforce `{ thinkingLevel: 'minimal' }` for all Gemini 3 series requests, ensuring instant generation with zero reasoning delays.
  - *Why*: Outing recommendations rely on concise JSON arrays, where excessive reasoning adds unnecessary seconds to the user experience.
- **Decision 3: Transparent LocalStorage Upgrade**
  - *Chosen Approach*: In `loadInitialConfig()`, detect if `md` matches obsolete models (e.g. `1.5`, `2.0`, `2.5`) and immediately upgrade to `gemini-flash-latest`.
  - *Why*: Prevents returning users with stale localStorage data from continuing to hit deprecated model endpoints.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       ActivitiesTab                         │
│  ┌───────────────────────┐       ┌────────────────────────┐ │
│  │ Fast Mode / AI Deck   │       │ SetupModal (Model Cfg) │ │
│  └───────────┬───────────┘       └───────────┬────────────┘ │
└──────────────┼───────────────────────────────┼──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 storage.ts (State & Sanitize)               │
│  - loadInitialConfig(): auto-upgrade legacy model cache     │
│  - Default model: 'gemini-flash-latest'                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   gemini.ts (Engine Client)                 │
│  - DEFAULT_FAST_MODELS: ['gemini-flash-latest',             │
│                          'gemini-3.8-flash',                │
│                          'gemini-3.1-flash-lite']           │
│  - thinkCfg(): { thinkingLevel: 'minimal' } for 3.x/latest  │
│  - backups(): prioritize 3.8-flash and 3.1-flash-lite       │
│  - SSE stream reader + extractCompletedObjects parser       │
└─────────────────────────────────────────────────────────────┘
```

- **Data Model & State Updates**:
  - `AppConfig.md`: Defaults to `'gemini-flash-latest'`.
  - `DEFAULT_FAST_MODELS`: Updated to `['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']`.
  - `thinkCfg(model)`: Returns `{ thinkingLevel: 'minimal' }` for all `gemini-3.*` and `gemini-flash-latest`.
- **Interactive Component Mapping**:
  - `ActivitiesTab.tsx`: Continues driving fast-mode streaming via `askGergAI`.
  - `PintdrOverlay.tsx`: Displays streaming cards dynamically with real-time generation times.
  - `SetupModal.tsx`: Lists modern models with clear badges in the settings interface.
