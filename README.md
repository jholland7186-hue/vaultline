# Vaultline

Save-first spend coach with obligations clarity — Android + Web, local-first.

Brand: forest green `#1B4332`, copper `#C47A3A`, sand `#F3EDE3`.

## Run

```bash
cd C:\Users\jholl\vaultline
bun install   # or: npm install
bun run web   # web
bun run android
bun start     # Expo Dev Tools (pick platform)
```

## MVP scope

- **Payday waterfall (local/virtual):** paycheck → obligations due this period → save-first → remainder = discretionary spend pot. Home shows spoken-for vs free-to-spend. No bank API.
- Home: waterfall glance, save-first checkbox, primary goal progress, next due, spend pot usage
- Obligations: credit card, insurance, rent, loan, Cash App payback, subscription
- Manual spend log with needs / wants / eating out / other
- Seed demo data (AsyncStorage / Zustand persist)
- No bank APIs, no cooling-off

## Remote

https://github.com/jholland7186-hue/vaultline
