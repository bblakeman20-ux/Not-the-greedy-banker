# Not The Greedy Banker 🍻

Anti-default outing planner for a group of mates: pitch and vote on venues (with the Veto Bounty), find a date everyone's free, work out the fairest midpoint, ask **Gerg AI** for hidden gems, live events and combo nights, and split the kitty with pay links.

It's a single `index.html` with no build step. On its own it runs in **Local Mode** with demo data. Add a Firebase database to sync a group, and a Gemini key for Gerg AI.

## 1. Host it (GitHub Pages)

1. On GitHub, go to the repo's **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then press **Save**.
3. After a minute the app is live at `https://bblakeman20-ux.github.io/Not-the-greedy-banker/`.

It needs https for the 📲 Install button, offline use and Messenger sharing. Opening the file directly works, but without those three.

## 2. Live sync (Firebase Realtime Database)

1. Go to <https://console.firebase.google.com> → **Add project**. Google Analytics isn't needed.
2. **Build → Realtime Database → Create database**. Pick **Europe (europe-west1)** and start in **locked mode**.
3. Open the **Rules** tab, replace everything with the contents of [`database.rules.json`](database.rules.json), and press **Publish**.
4. Copy the database URL (`https://<project>-default-rtdb.europe-west1.firebasedatabase.app`).
5. In the app: **⚙️ Setup** → paste the URL → tap **🎲** for a secret room code → **💾 Save & Connect**.
6. Tap **💬 Share Group Link** and send it to the group chat. Everyone who opens it joins the same room.

### What the rules protect, and what they don't

- **Nobody can list or download every room.** A room can only be read by someone who knows its exact code.
- **Room codes must be at least 12 characters.** Short guessable codes like `medway-squad` are rejected, and the 🎲 button makes a long random one.
- **A room can't be wiped in one go**, and the rest of the database is closed.
- **But anyone who has the group link can read and edit that room.** There's no login. Treat the link like a password: keep it in the private chat, and if it leaks, tap 🎲 for a new room and share the new link.
- **Prefer pay links (monzo.me / paypal.me) over sort code and account number.** Anyone with the link can see whatever pay details people add.

### Moving an existing room

Rooms made before this update lived under `/rooms/…`. The new rules close that path, so the app starts a fresh room instead of copying the old one. If you want to keep an old room's plan, publish the rules with this extra block next to `"v2"` for a day, open the app once, then remove it:

```json
"rooms": { "$room": { ".read": true, ".write": true } }
```

## 3. Gerg AI (Gemini API key)

1. Create a key at <https://aistudio.google.com/apikey>.
2. **Lock it to your site**, so a copied key is useless elsewhere:
   1. Open <https://console.cloud.google.com/apis/credentials>, choosing the project the key belongs to.
   2. Click the key.
   3. **Application restrictions → Websites**, then add `https://bblakeman20-ux.github.io/*`.
   4. **API restrictions → Restrict key**, then tick only **Generative Language API**.
   5. Press **Save**.
3. Optional: **Billing → Budgets & alerts**, so you're told before any spend. The What's on and Surprise me modes use Google Search grounding, which is free up to a daily limit and charged after that.
4. In the app: **⚙️ Setup** → paste the key → **💾 Save**.

The key is only saved on that phone (browser storage). It is **never** synced to the room. Don't paste it into the group chat. Anyone who wants to use Gerg AI enters a key on their own phone.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `database.rules.json` | Firebase security rules (paste into the console) |
| `manifest.webmanifest`, `sw.js`, `icon*` | Installable app and offline support |
