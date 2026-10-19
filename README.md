# PROJECT A.R.I.A. — Arduino UNO R4 WiFi + iPad + Cloud AI

## What it does
- HC-SR04 hand proximity selects HEART / BRAIN / LUNGS / PHARMACY.
- iPad Safari dashboard displays animated medical themed interface, distance and gesture.
- iPad asks educational questions. Optional OpenAI API; built-in demo response fallback.
- Arduino's built-in LED matrix changes patterns for the selected topic.
- No servo, no medical diagnosis, no patient data collection.

## Wiring
HC-SR04 VCC -> UNO R4 5V; GND -> GND; TRIG -> D9; ECHO -> D10. Check module voltage rating and pin labels before connecting. Power UNO from USB-C. No other components needed.

## Cloud deployment (Render example)
1. Create a GitHub repository and upload `server.js`, `package.json`, `public/` (and optionally `arduino/`).
2. Render > New > Web Service > connect repo. Runtime Node. Build command: `npm install`; Start command: `npm start`.
3. Environment variables: `DEVICE_TOKEN` = a long random secret; optionally `OPENAI_API_KEY` = your own API key; optionally `OPENAI_MODEL` = a model available to your account (default `gpt-4o-mini`).
4. Deploy and open `https://YOUR-APP.onrender.com` in iPad Safari. Grant microphone permission if supported. Some Safari versions do not support web SpeechRecognition: type instead. Text-to-speech availability depends on Safari settings.
5. Render free services may sleep or cold-start. Open the page 5 minutes before demo; for reliability use an always-on hosting plan.

## Arduino setup
1. Arduino IDE 2.x > Boards Manager > install `Arduino UNO R4 Boards` (includes WiFiS3).
2. Select Arduino UNO R4 WiFi board and its port. Open `arduino/ARIA_UNO_R4_WiFi.ino`.
3. Edit `WIFI_SSID`, `WIFI_PASS`, `CLOUD_HOST` (only hostname, without https:// or slash), and `DEVICE_TOKEN` (exactly matching Render).
4. Upload. Open Serial Monitor 115200 baud. The board needs internet access and correct TLS root certificates/firmware. If TLS fails, update UNO R4 WiFi connectivity firmware/certificates via Arduino IDE firmware updater and check the hostname.
5. Wave hand 5–25 cm from sensor for ~0.2 s, then remove it; each new entry cycles one topic. Observe iPad and LED matrix.

## Test cloud without hardware
Open iPad dashboard, tap any topic, tap SURPRISE ME, type a question, and optionally enable voice. Hardware status will show ARDUINO OFFLINE. This is expected without a connected board.

## Important constraints
- Cloud must be reachable from both the Arduino WiFi and the iPad; no local-network requirement.
- The device endpoint uses `X-Device-Token` authentication; UI controls are intentionally public for supervised booth use. Do not expose the service as a public clinical system.
- Optional AI calls may incur charges. No secrets in public frontend or Arduino except the device token, which is not an OpenAI key.
- This is an educational demo only, not a diagnostic tool. The visuals are stylized symbols, not actual holograms or clinically accurate 3D anatomy.
- WiFiS3 TLS and free-host cold starts can vary; test on the actual network in advance. For guaranteed showtime, keep iPad's demo page open and use manual topic selection if device networking fails.
