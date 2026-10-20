# A.R.I.A. — OpenAI migration patch

This ZIP contains **only the changed files**. Replace these two paths in the existing GitHub repository:

- `server.js` (repository root)
- `public/app.js`

Keep the existing `public/index.html`, `public/style.css`, `package.json`, and Arduino sketch unchanged.

## Render > Environment

Set:
- `OPENAI_API_KEY` = the API key created at https://platform.openai.com/api-keys
- `OPENAI_MODEL` = `gpt-4o-mini` (or another Chat Completions-supported model you can access)
- `DEVICE_TOKEN` = your existing Arduino token (keep it unchanged unless rotating both places)

Remove `GEMINI_API_KEY` and `GEMINI_MODEL` if no longer needed. Never place API keys in source code or on the Arduino.

Commit changed files to GitHub, deploy Render, and reload Safari. The Dashboard LED turns green after a real successful OpenAI response and red when unavailable. The GET `/api/ai-status` endpoint will make a **billable** test request at most once every 120 seconds per Render instance while being checked. The API endpoint `/api/ask` returns `mode: OPENAI` on success and `DEMO` on fallback.

To troubleshoot, inspect Render Logs for `AI availability check failed` and `OpenAI HTTP 401/403/429`. `401` suggests key error; `429` suggests rate/quota/billing issues; `404` may mean unsupported model.

## Validation

From the project root run `node --check server.js` and `node --check public/app.js`. Open the iPad Dashboard and ask a question. An OpenAI key and an API billing setup may be required; ChatGPT subscriptions do not pay for API usage.

Your UNO R4 WiFi firmware and wiring are unchanged; an `HTTP 200` / `TELEMETRY ACCEPTED` on Serial Monitor already confirms the Arduino->Render path.

Educational simulation only — not for diagnosis or personalized medical decisions.
