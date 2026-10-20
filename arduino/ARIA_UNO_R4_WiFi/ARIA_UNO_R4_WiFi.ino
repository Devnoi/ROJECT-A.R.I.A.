#include <WiFiS3.h>
#include <Arduino_LED_Matrix.h>

// ===== CONFIGURATION =====
// Use the exact SSID, including any spaces.
const char WIFI_SSID[] = "YOUR_WIFI_NAME_EXACTLY";
const char WIFI_PASS[] = "PUT_YOUR_WIFI_PASSWORD_HERE";

// Hostname ONLY: do not add https:// or a trailing slash.
const char CLOUD_HOST[] = "roject-a-r-i-a.onrender.com";
const int CLOUD_PORT = 443;

// Must match DEVICE_TOKEN in Render > Environment.
// Generate a NEW token: the previous token was exposed in chat.
const char DEVICE_TOKEN[] = "PUT_YOUR_NEW_DEVICE_TOKEN_HERE";

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

// ===== GLOBALS =====
ArduinoLEDMatrix matrix;
WiFiSSLClient client;

unsigned long lastPost = 0;
unsigned long lastAttempt = 0;
unsigned long lastWiFiAttempt = 0;
unsigned long lastGesture = 0;
unsigned long nearSince = 0;
bool nearLatched = false;
bool lastSendFailed = false;
bool pendingSwipe = false;
String currentTopic = "HEART";

void showTopic(const String &topic) {
  uint8_t frame[8][12] = {};
  int n = topic == "HEART" ? 3 : topic == "BRAIN" ? 5 : topic == "LUNGS" ? 7 : 9;
  for (int y = 1; y < 7; ++y) {
    for (int x = 1; x < 11; ++x) {
      if ((x + y + n) % n == 0 || (y == 3 && x >= 3 && x <= 8)) {
        frame[y][x] = 1;
      }
    }
  }
  matrix.renderBitmap(frame, 8, 12);
}

long measureCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1;  // No echo: check sensor wiring/power.
  return (long)(duration / 58UL);
}

void printNetworkDiagnostics() {
  Serial.print("WiFi status: ");
  Serial.println(WiFi.status());
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());

  IPAddress serverIP;
  if (WiFi.hostByName(CLOUD_HOST, serverIP)) {
    Serial.print("DNS OK: ");
    Serial.println(serverIP);
  } else {
    Serial.println("DNS FAILED: Check hostname or network DNS.");
  }
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  const unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000UL) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi CONNECTED");
    printNetworkDiagnostics();
  } else {
    Serial.println("\nWiFi FAILED: Check SSID, password, 2.4 GHz and captive portal.");
  }
}

// Sends telemetry to Render, reads the topic in the JSON response.
bool sendTelemetry(long distance, const char *gesture) {
  if (WiFi.status() != WL_CONNECTED) return false;

  client.stop();
  Serial.print("Connecting HTTPS to ");
  Serial.println(CLOUD_HOST);

  if (!client.connect(CLOUD_HOST, CLOUD_PORT)) {
    Serial.println("TLS connection FAILED");
    printNetworkDiagnostics();
    client.stop();
    return false;
  }

  const String payload = "{\"distance\":" + String(distance) +
                         ",\"gesture\":\"" + String(gesture) + "\"}";

  client.print("POST /api/device HTTP/1.1\r\nHost: ");
  client.print(CLOUD_HOST);
  client.print("\r\nUser-Agent: ARIA-UNO-R4\r\nContent-Type: application/json");
  client.print("\r\nX-Device-Token: ");
  client.print(DEVICE_TOKEN);
  client.print("\r\nConnection: close\r\nContent-Length: ");
  client.print(payload.length());
  client.print("\r\n\r\n");
  client.print(payload);

  String response;
  const unsigned long started = millis();
  while (millis() - started < 6000UL) {
    while (client.available()) {
      const char c = (char)client.read();
      if (response.length() < 3000) response += c;
    }
    if (!client.connected() && !client.available()) break;
    delay(5);
  }
  client.stop();

  // First HTTP status line is useful to identify 401/404/503 problems.
  const int lineEnd = response.indexOf("\r\n");
  const String statusLine = lineEnd >= 0 ? response.substring(0, lineEnd) : response;
  Serial.print("HTTP: ");
  Serial.println(statusLine.length() ? statusLine : "No response");

  if (statusLine.indexOf(" 200 ") < 0) {
    if (statusLine.indexOf(" 401 ") >= 0) {
      Serial.println("401: DEVICE_TOKEN mismatches Render Environment.");
    } else if (statusLine.indexOf(" 404 ") >= 0) {
      Serial.println("404: Check CLOUD_HOST and /api/device endpoint.");
    } else if (statusLine.indexOf(" 301 ") >= 0 || statusLine.indexOf(" 302 ") >= 0) {
      Serial.println("Redirect: Check CLOUD_HOST and HTTPS service URL.");
    } else if (statusLine.indexOf(" 503 ") >= 0 || statusLine.indexOf(" 502 ") >= 0) {
      Serial.println("Render may be starting or unreachable; retry later.");
    }
    return false;
  }

  Serial.println("TELEMETRY ACCEPTED by Render");
  const String key = "\"topic\":\"";
  int p = response.indexOf(key);
  if (p >= 0) {
    p += key.length();
    const int end = response.indexOf('"', p);
    if (end > p) {
      const String t = response.substring(p, end);
      if ((t == "HEART" || t == "BRAIN" || t == "LUNGS" || t == "PHARMACY") && t != currentTopic) {
        currentTopic = t;
        showTopic(t);
        Serial.print("Topic changed to: ");
        Serial.println(t);
      }
    }
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  matrix.begin();
  showTopic(currentTopic);
  Serial.println("=== A.R.I.A. WiFi + HTTPS + Ultrasonic ===");
  connectWiFi();
}

void loop() {
  const unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWiFiAttempt >= 12000UL) {
      lastWiFiAttempt = now;
      connectWiFi();
    }
    delay(50);
    return;
  }

  const long cm = measureCm();
  const bool near = cm >= 5 && cm <= 25;

  if (near && !nearLatched) {
    if (nearSince == 0) nearSince = millis();
  } else if (!near) {
    nearSince = 0;
    nearLatched = false;
  }

  bool swipe = false;
  if (near && !nearLatched && nearSince != 0 &&
      millis() - nearSince >= 180UL && millis() - lastGesture > 1500UL) {
    swipe = true;
    pendingSwipe = true;
    nearLatched = true;
    lastGesture = millis();
  }

  // When TLS fails, do not hammer the cloud every 900 ms.
  const unsigned long interval = lastSendFailed ? 5000UL : 900UL;
  if (millis() - lastAttempt >= interval || (swipe && !lastSendFailed)) {
    lastAttempt = millis();
    Serial.print("Distance: ");
    Serial.print(cm);
    Serial.println(cm < 0 ? " (NO ECHO)" : " cm");
    lastSendFailed = !sendTelemetry(cm, pendingSwipe ? "SWIPE" : near ? "NEAR" : "WAITING");
    if (!lastSendFailed) { lastPost = millis(); pendingSwipe = false; }
  }
  delay(45);
}
