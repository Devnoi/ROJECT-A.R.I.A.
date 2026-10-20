# PROJECT A.R.I.A. — Arduino ↔ Render Connection Fix

This package includes the complete web backend, Safari dashboard, and corrected Arduino sketch.

## 1. Before upload

Open `arduino/ARIA_UNO_R4_WiFi/ARIA_UNO_R4_WiFi.ino` and edit **only**:

```cpp
const char WIFI_SSID[] = "YOUR_WIFI_NAME_EXACTLY";
const char WIFI_PASS[] = "PUT_YOUR_WIFI_PASSWORD_HERE";
const char CLOUD_HOST[] = "roject-a-r-i-a.onrender.com";
const char DEVICE_TOKEN[] = "PUT_YOUR_NEW_DEVICE_TOKEN_HERE";
```

Use exactly your Render service hostname for CLOUD_HOST, without `https://` or trailing `/`.
Set a **new random** `DEVICE_TOKEN` under Render → Environment (keep secrets off public GitHub).
Keep `GEMINI_API_KEY` and optional `GEMINI_MODEL` in Render only. The AI LED remains red until a Gemini call succeeds.

## 2. Upload Arduino

Install Arduino UNO R4 Boards via Arduino IDE Boards Manager. Open the `.ino` in the Arduino sketch folder; Board: UNO R4 WiFi, choose USB Port, Upload (arrow). Serial Monitor 115200.

Sensor HC-SR04: VCC->5V, GND->GND, TRIG->D9, ECHO->D10.

## 3. Upload Backend files to GitHub

Replace `server.js`, `public/app.js`, `public/index.html`, `public/style.css` and `package.json` in your repository with matching paths. Do not upload your Arduino sketch with secret passwords/tokens. If you want it on GitHub, replace them with placeholders first.
Render Web Service: `npm install` for build, `npm start` for start. Deploy and wait for Live.

## 4. Verify exact failure point

Visit `https://YOUR-SERVICE.onrender.com/api/state` while board is powered on. `lastSeen` must become nonzero and `connected: true` while updates arrive.

Serial Monitor meanings:
- `WiFi CONNECTED`: Wi-Fi is up, not proof the backend received anything.
- `DNS OK`: hostname resolves; not proof HTTPS worked.
- `TLS connection FAILED`: DNS/firmware/network/host/certificate issue; no POST delivered.
- `HTTP 401`: DEVICE_TOKEN mismatch.
- `HTTP 200` + `TELEMETRY ACCEPTED by Render`: board POST was accepted. Dashboard should show Arduino Online while it keeps posting.
- `Distance -1 (NO ECHO)`: HC-SR04 did not echo; independently check sensor wiring.

Render Logs will additionally show `[DEVICE] POST accepted` or `[DEVICE] POST rejected: HTTP 401`, without exposing token values.

If Arduino says HTTP 200 repeatedly but `/api/state` stays at zero, double-check that Arduino CLOUD_HOST and the URL opened on the iPad are the SAME Render service; check if more than one service instance is running (this demo holds state in memory).

**Important:** This is an educational demonstration, not a medical device.
