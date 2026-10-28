# Pintdr 🍻

Anti-default outing planner for a group of mates: pitch and vote on venues (with the Veto Bounty), find a date everyone's free, work out the fairest midpoint, ask **Gerg AI** for hidden gems, live events and combo nights, and split the kitty with pay links.

Rewritten as a modern React + TypeScript + Tailwind CSS application powered by Vite. Runs seamlessly in **Local Mode** with demo data, or connects to Firebase Realtime Database for real-time live sync across devices, plus Gemini for Gerg AI.

---

## Features

- **Interactive Calendar Grid & Tap-to-Select**: Month grid view with one-touch multi-date tapping to log availability in seconds.
- **Visual Overlap Tally Chart**: Live ranked ranking chart showing dates with the highest squad overlap, color-coded by alignment level (with 100% full squad alignment unlocking `.ics` and Google Calendar export). Directly interactive: tap any bar to toggle your vote on the spot!
- **Gerg AI Date Extractor (Gemini)**: Free-text input where squad members can paste natural statements (e.g. *"Free next Friday after 6pm, all day Saturday, or any weekend in November except the 14th"*) and Gemini automatically maps them to calendar dates and increments the date tallies.
- **Instant QR Code Scan-to-Join**: Tap the `📱 QR` button in the header to display a high-contrast QR code that any phone can scan to jump straight into the live squad room.
- **Anti-Default Planning & Ban List**: Ban default chain pubs and uninspired spots permanently (or temporarily).
- **Veto Bounty**: When someone vetoes a venue, a 60-second countdown begins. If they don't pitch a better replacement before time runs out, they owe the squad the first round!
- **Bounty Board**: Track who redeems their vetoes versus who ends up buying the first round across nights out.
- **Roulette**: Let fate pick a non-vetoed venue with a live spinning animation and celebratory confetti.
- **Free Map Ideas Engine**: Query real independent spots and multi-stop combo nights using OpenStreetMap Overpass API and Photon with zero API keys required.
- **Gerg AI Venue Engine (Gemini)**: 4 smart planning modes (Hidden gems, What's on with live Google Search grounding, Combo night, and Surprise me wildcard).
- **Squad Travel & Midpoint Finder**: Calculate geographic centroid between all squad stations and measure distances to the midpoint and winning venue.
- **Room Colour Themes**: Pick, cycle or customise a 4–5 colour palette for the whole UI; it's saved with the room so everyone sees the same theme.
- **Sherlock's Open Bank Mode & Kitty**: Track group expenses, view squad pay details (Monzo, PayPal.me, Revolut, bank details), compute simplified settlement payments with one-click payment links, and keep an audit log of paid debts.

---

## 1. Development & Local Mode

Run the development server:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. By default, the application opens in **Local Mode** with pre-populated demo data so you can test all features right away.

To build for production:

```bash
npm run build
```

---

## 2. Live Sync (Firebase Realtime Database)

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Realtime Database → Create database**. Choose your region (e.g. `europe-west1`) and start in **locked mode**.
3. Open the **Rules** tab, replace everything with the contents of [`database.rules.json`](database.rules.json), and press **Publish**.
4. Copy the database URL (`https://<project>-default-rtdb.europe-west1.firebasedatabase.app`).
5. In the app: tap **⚙️ Setup** → paste the URL → tap **🎲** for a secret room code → **💾 Save & Connect**.
6. Tap **💬 Share Group Link** to send the invitation to your group chat. Everyone who opens it joins the room in real time.

### Who can change what

On the built-in database each phone signs in anonymously (**Authentication → Sign-in method → Anonymous**, with automatic clean-up off) using the Web API key in `src/utils/auth.ts`. The rules then let only a profile's own phone change its pay details; everything else in a room stays editable by anyone in it. A profile is owned by the phone that created it, or the first phone to claim it. If someone loses their phone, clear the `owner` field on their profile in the Firebase console so they can claim it again.

The rules are tested against the local emulator: `firebase emulators:start --only database`, then point the app at `http://<project>.localhost:9000` in Setup.

---

## 3. Gerg AI (Gemini API Key)

Gerg AI runs on the server, so the key never reaches the browser.

1. Get an API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it as `GEMINI_API_KEY` in the server's environment (see `.env.example`).
3. Optional: set `GEMINI_MODELS` (comma-separated) to pin models. By default the server uses Google's `gemini-flash-latest` and `gemini-flash-lite-latest` aliases and skips any model the key can't use.

If Gerg AI is unavailable (no key, rejected key, usage limit, offline) the app says so and falls back to real map spots – it never shows made-up venues.

A Builder Admin (tap the logo 5 times) can also enter their own key under **Setup → Builder Admin**. It stays on that device and is sent with that device's Gerg AI requests only.

---

## 4. Checks

```bash
npm run lint   # typecheck app and server
npm run test   # Vitest suite (kitty maths, dates, sync, themes, plan actions)
npm run build
```

GitHub Actions runs all three on every push.

## 5. Project layout

- `server.ts` – Express server (Vite in dev, `dist/` in production); `api/index.ts` is the Vercel entry. Both use the Gerg AI routes in `server/gemini.ts`.
- `src/App.tsx` – room state, Firebase sync and tab routing.
- `src/utils/` – pure logic: `eventActions.ts` (votes, vetoes, shortlist), `kitty.ts` (ledger and settle-up), `firebase.ts` (sync), `theme.ts` (palettes), `dates.ts`, `osm.ts` / `mapRoll.ts` (map search), `gemini.ts` (Gerg AI client). Tests live in `src/utils/__tests__/`.
- `src/components/Tabs/` – the four tabs; `src/components/activities/` – the Activities tab's panels.
