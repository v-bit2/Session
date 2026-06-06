# VOLTRA MD — WhatsApp Pair Code Generator

Built by **Drey**. Generates a custom WhatsApp Multi-Device pair code (`VOLTRAMD`) and automatically delivers the `creds.json` session file to the linked WhatsApp chat.

## Stack
- Node.js ≥ 20
- Express 4
- **baileys** (latest renamed package — replaces the old `@whiskeysockets/baileys`)
- pino, qrcode, awesome-phonenumber

## Setup
```bash
npm install
npm start
```
Server listens on `http://localhost:8000`.

## Pair flow
1. Open the site.
2. Enter your full international number (e.g. `2348012345678`, no `+`).
3. Click **Generate Pair Code** — server returns `VOLT-RAMD`.
4. WhatsApp → Settings → Linked Devices → Link a device → **Link with phone number** → enter `VOLTRAMD`.
5. On successful link, `creds.json` is sent automatically to your own chat.

## Notes
- The `baileys` package (no scope) is the **maintained** fork. The old `@whiskeysockets/baileys` is outdated and pair codes frequently fail to link with current WhatsApp.
- The custom code must be 8 chars, `A–Z` / `0–9` only.
- Deploy on a persistent Node host (Render, Railway, Fly.io, VPS). Not for serverless.

## Custom pair code
Edit `pair.js`:
```js
const CUSTOM_PAIR_CODE = 'VOLTRAMD';
```

© 2025 Drey · VOLTRA MD
