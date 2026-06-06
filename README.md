# VOLTRA MD

WhatsApp pair-code session generator.

**Developer:** Drey

## Setup

```bash
npm install
npm start
```

Open http://localhost:8000

## Custom Pair Code

The pairing code is hardcoded to **VOLTRAMD** (8 chars). Edit `CUSTOM_PAIR_CODE` in `pair.js` to change it. WhatsApp requires exactly 8 characters, A–Z / 0–9 only.

## How it works

1. User enters WhatsApp number with country code.
2. Server requests a pairing code from WhatsApp via Baileys.
3. User enters `VOLTRA-MD` in WhatsApp → Linked Devices → Link with phone number.
4. On successful link, the `creds.json` session file is sent to the user's own WhatsApp chat automatically. No download button on the site.

## Deployment

Requires a persistent Node.js host (Render, Railway, Fly.io, VPS). Will NOT work on Cloudflare Workers / Vercel serverless because Baileys needs a long-lived WebSocket.
