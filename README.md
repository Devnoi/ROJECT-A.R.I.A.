# A.R.I.A. — Gemini AI Mode Fix

Fix for repository: https://github.com/Devnoi/ROJECT-A.R.I.A.

## Replace on GitHub (preserve paths)
- `server.js` in repository root
- `public/app.js` in `public/`
- `package.json` in repository root (optional, includes syntax check script)

**Keep existing `public/index.html`, `public/style.css`, and Arduino sketch unchanged.**

## Render Environment Variables
- `GEMINI_API_KEY`: the key you create in Google AI Studio (secret; enter only in Render)
- `GEMINI_MODEL`: `gemini-2.5-flash` or another available model
- `DEVICE_TOKEN`: same token as in Arduino sketch
- `NODE_ENV`: `production` (optional)

Redeploy after committing changes. Do not expose the Gemini API key in GitHub or Arduino.

## Test
1. After Render shows **Live**, open `https://YOUR-SERVICE.onrender.com/api/ai-status`.
2. `READY` = configured, but has not answered successfully yet.
3. Open Dashboard and ask a question; `GEMINI AI` should appear only after a successful Gemini answer.
4. Refresh `/api/ai-status`: `GEMINI` = last AI request succeeded, `DEMO` = no key or last request failed.
5. If `DEMO`, look for `Gemini unavailable:` in Render Logs. Verify the model name, billing, free-tier quotas and key restrictions in AI Studio.

Note: `READY` confirms an API key is present, not whether it is valid. This service uses simulated educational content only.
