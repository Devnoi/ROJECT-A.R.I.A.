# A.R.I.A. Gemini Health Greeter

An educational medical booth for Arduino UNO R4 WiFi, HC-SR04 and iPad Safari.

## Visitor interaction
- HC-SR04 within **2–10 cm** in two consecutive posts (~1.5 seconds) triggers one greeting event.
- Retract to **15 cm or farther** for two consecutive posts to re-arm. A 5-second cooldown reduces rapid retriggering.
- The **iPad** speaks using browser Speech Synthesis, not the Arduino. In Safari press **ENABLE VOICE** once after opening the site to unlock audio. Browser autoplay policies may still restrict unattended speaking; test on the exact iPad.
- Questions go to Gemini via Render backend. Voice recognition is browser-dependent. Text input always works.
- "AI LINK" green means a Gemini API call succeeded; red means not verified/unavailable. The health-check API calls the model every ~2 minutes if viewed.

## Wiring
HC-SR04 VCC→5V, GND→GND, TRIG→D9, ECHO→D10.

## Render
- Upload project files to GitHub preserving `/public` and `/arduino` folders.
- Render Node Web Service: Build Command `npm install`, Start Command `npm start`.
- Set `GEMINI_API_KEY` from Google AI Studio, `GEMINI_MODEL=gemini-2.5-flash` (or supported model), and `DEVICE_TOKEN` to a new private random token.
- No OpenAI key is required for this project. Gemini API free eligibility/quotas depend on the account/model.
- Render free instances may sleep, delaying first interactions.

## Arduino
- Open `arduino/ARIA_Health_Greeter/ARIA_Health_Greeter.ino` in Arduino IDE.
- Enter Wi-Fi SSID/password, **hostname only** in `CLOUD_HOST`, and the exact `DEVICE_TOKEN` from Render.
- Board: Arduino UNO R4 WiFi. Upload, then use Serial Monitor 115200.
- Expect `HTTP: HTTP/1.1 200 OK`. `401` means mismatched token. Test `https://YOUR-HOST/api/state` for `connected:true`, `greetingId` incrementing after approaching, and `visitorPresent`.
- Change previously exposed Wi-Fi password and device token. Do not publish credentials in the Arduino sketch.

## Test
1. Launch Dashboard in Safari, tap `ENABLE VOICE`. Confirm it says "Voice ready".
2. Put a flat object 5–10 cm from the sensor for ~2 seconds. The Dashboard should display and speak the greeting once.
3. Keep the object near; it should not repeat. Withdraw beyond 15 cm for ~2 seconds; repeat approach to re-trigger.
4. Ask "What does the heart do?". Watch AI light and Render logs. If Gemini is unavailable the answer falls back to educational demo text and light stays red.

**Privacy/safety:** Use fictional/general health questions, no patient-identifiable data; this is not a medical diagnostic system. Gemini responses are generated from model knowledge, not a live web search or verified medical database.
