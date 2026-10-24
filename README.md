# Vaultline

Save-first spend coach with obligations clarity — Android + Web, local-first.

Brand: forest green `#1B4332`, copper `#C47A3A`, sand `#F3EDE3`.

Expo account: `zerofallen001` · projectId in `app.json` (`extra.eas.projectId`).

## Run

```bash
cd C:\Users\jholl\vaultline
bun install   # or: npm install
bun run web   # web
bun run android
bun start     # Expo Dev Tools (pick platform)
```

## Android APK (preview)

```bash
bun run build:apk
# same as: eas build -p android --profile preview
```

Preview builds use EAS Update **channel `preview`**. Production profile uses channel **`production`**.

## OTA updates (EAS Update)

Config (no secrets in repo):

- `app.json`: `runtimeVersion.policy = appVersion`, `updates.url = https://u.expo.dev/<projectId>`
- `eas.json`: build profiles set `channel` (`preview` / `production` / `development`)
- Dependency: `expo-updates`

Publish a JS/asset update to the preview APK channel:

```bash
eas update --channel preview --message "what changed"
# or: bun run update:preview -- "what changed"
```

Production channel (after a production build):

```bash
eas update --channel production --message "what changed"
# or: bun run update:production -- "what changed"
```

Notes:

- OTA only ships JS/assets compatible with the build’s **runtimeVersion** (tied to `expo.version`, currently `0.1.0`). Native changes need a new APK/AAB.
- Rebuild the preview APK once after this wiring so the binary embeds the update channel + URL. Older APKs without `expo-updates` / channel won’t receive OTAs.
- Never commit Expo tokens or `.env` secrets — use `eas login` locally / CI secrets.

## Planning lookback

- Default **2 months** of catch-up history through today (Spend → **Planning lookback**: 1 or 2 months).
- UI copy: “Planning from [start] → today”.
- Due: catch-up section (lookback → today) + upcoming ~1 month forward.
- Spend: optional backdate within the lookback window.
- Waterfall / spend pot still use the **current pay period** (e.g. this week for weekly pay).

## Screenshot history catch-up

- Spend → **Screenshot history catch-up**: gallery (multi) or camera → optional paste → review **income / spend / bill** lines → **Confirm & save**.
- On-device OCR via `expo-text-extractor` when the APK includes the native module; otherwise paste / best-effort. Always confirm.
- Writes confirmed spends + income events into the lookback window (never silent).

## MVP scope

- **Payday waterfall (local/virtual):** paycheck → obligations due this period → save-first → remainder = discretionary spend pot. Home shows spoken-for vs free-to-spend. No bank API.
- Home: waterfall glance, save-first checkbox, primary goal progress, next due, spend pot usage
- Obligations: credit card, insurance, rent, loan, Cash App payback, subscription
- Manual spend log with needs / wants / eating out / other
- Seed demo data (AsyncStorage / Zustand persist)
- No bank APIs, no cooling-off

## Remote

https://github.com/jholland7186-hue/vaultline
