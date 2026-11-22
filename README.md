# Device & IP Diagnostic Logger

A consent-based Node.js app. Visitors can review a preview, choose **Continue**, submit a diagnostic report, and then are redirected to https://www.amazon.in/.

## What is collected after Continue
- Server-observed IP address and request User-Agent
- Browser-reported OS/platform, browser family, device category, language, timezone, screen and viewport sizes, CPU core count, touch points, and model only if the browser exposes it
- Counts and approximate byte sizes for this site's own LocalStorage and SessionStorage; count of this site's readable cookies; IndexedDB database count when the browser supports enumeration

The app does **not** read other sites' cookies, passwords, browser history, contacts, IMEI, or private files. Browser APIs may return incomplete values. No geolocation lookup is configured.

## Requirements
- Node.js 18+
- npm

## Setup
1. Extract the ZIP and open a terminal in this folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Create a bcrypt password hash:
   ```bash
   node -e "require('bcryptjs').hash('Choose-A-Strong-Password',12).then(console.log)"
   ```
5. Put the generated hash in `ADMIN_PASSWORD_HASH` in `.env`. Set a long random `SESSION_SECRET` (32+ characters), and change `ADMIN_USERNAME`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

## Admin
Open `http://localhost:3000/admin/login` and use the username/password configured in `.env`. Reports are visible at `/admin`; use Export CSV to download them.

## Deployment notes
- Use HTTPS in production and set `NODE_ENV=production`.
- Use a persistent disk for the SQLite database.
- Set `TRUST_PROXY=1` only if the app is behind a proxy you control and have configured correctly.
- Back up and restrict access to `data/reports.sqlite`; IP addresses are personal data. Establish a retention/deletion policy and comply with applicable privacy laws.
- The default Express MemoryStore is intended for a small demo, not production. For production, configure a persistent session store and add operational monitoring.
- Do not remove the consent notice or disguise the collection. The Continue action is the visitor's affirmative choice.
