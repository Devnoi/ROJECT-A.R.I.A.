# A.R.I.A. — AI status light (Gemini)

Replace these FOUR files in the GitHub repository `Devnoi/ROJECT-A.R.I.A.` and preserve their paths:

- `server.js`
- `public/app.js`
- `public/index.html`
- `public/style.css`

**Light meanings:** Green = a real Gemini API request succeeded. Red = Gemini not verified / cannot be reached / API key missing. It starts red until a connection check completes. No Gemini vendor name is shown in the UI. In the server, `/api/ai-status` performs a small Gemini health request, cached for 2 minutes to reduce API use. The regular question endpoint still performs Gemini calls, and shows red if those fail. The indicator is not based solely on the presence of a key.

**Render Environment:** `GEMINI_API_KEY` (secret), `GEMINI_MODEL` (e.g. `gemini-2.5-flash`), `DEVICE_TOKEN` (matching Arduino). Do not put secrets on GitHub.

**Deploy:** Commit the files and wait for Render to become Live. Refresh Safari (reopen page if it was cached). Allow up to 20 seconds for first availability check. In Render Logs, search `Gemini availability check failed` or `Gemini unavailable` if LED remains red.

**Note:** The health check makes a real request on startup and roughly every 2 minutes while the dashboard is open; usage is subject to Gemini quotas and charges for paid-tier keys. The app continues to serve demo answers when AI is unavailable. Green indicates the latest verified connection succeeded, not a guarantee of future availability. Educational demonstration only, not clinical advice.
