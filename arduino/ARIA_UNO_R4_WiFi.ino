#include <WiFiS3.h>
#include <Arduino_LED_Matrix.h>

// Change these values before uploading.
const char WIFI_SSID[] = ".@ iMake WiFi";
const char WIFI_PASS[] = "imake1234";
const char CLOUD_HOST[] = "roject-a-r-i-a.onrender.com"; // hostname only, no https://
const char DEVICE_TOKEN[] = "02ce576839ed8d0913243f01870f4f42e4651e409dcf0e5f"; // same as cloud environment variable
const int CLOUD_PORT = 443;
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

ArduinoLEDMatrix matrix;
WiFiSSLClient client;
unsigned long lastPost = 0;
unsigned long lastGesture = 0;
unsigned long nearSince = 0;
bool nearLatched = false;
String currentTopic = "HEART";

void showTopic(const String& topic) {
  // Built-in LED matrix animation: center marker for each topic.
  uint8_t frame[8][12] = {};
  int n = topic == "HEART" ? 3 : topic == "BRAIN" ? 5 : topic == "LUNGS" ? 7 : 9;
  for (int y = 1; y < 7; y++) for (int x = 1; x < 11; x++) {
    if ((x+y+n)%n == 0 || (y==3 && x>=3 && x<=8)) frame[y][x] = 1;
  }
  matrix.renderBitmap(frame, 8, 12);
}

long measureCm() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 25000UL);
  if (us == 0) return -1;
  return (long)(us / 58UL);
}

String sendTelemetry(long distance, const char* gesture) {
  if (WiFi.status() != WL_CONNECTED) return "";
  if (!client.connect(CLOUD_HOST, CLOUD_PORT)) { Serial.println("TLS connection failed"); return ""; }
  String payload = "{\"distance\":" + String(distance) + ",\"gesture\":\"" + String(gesture) + "\"}";
  client.print("POST /api/device HTTP/1.1\r\nHost: "); client.print(CLOUD_HOST);
  client.print("\r\nUser-Agent: ARIA-R4\r\nContent-Type: application/json\r\nX-Device-Token: "); client.print(DEVICE_TOKEN);
  client.print("\r\nConnection: close\r\nContent-Length: "); client.print(payload.length());
  client.print("\r\n\r\n"); client.print(payload);
  unsigned long start=millis(); String response="";
  while (millis()-start<3500) {
    while (client.available()) {char c=client.read();if(response.length()<2200)response+=c;start=millis();}
    if (!client.connected()) break;
    delay(5);
  }
  client.stop();
  // Small JSON parser without extra dependencies; only reads server's fixed topic field.
  int p=response.indexOf("\"topic\":\"");
  if (p>=0) {p+=9;int end=response.indexOf('"',p);if(end>p){String t=response.substring(p,end);if(t!=currentTopic){currentTopic=t;showTopic(t);Serial.println("Topic: "+t);}}}
  return response;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  matrix.begin(); showTopic(currentTopic);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long started=millis();
  while(WiFi.status()!=WL_CONNECTED && millis()-started<20000) {delay(500);Serial.print('.');}
  Serial.println(WiFi.status()==WL_CONNECTED?"\nWiFi connected":"\nWiFi not connected");
}

void loop() {
  if(WiFi.status()!=WL_CONNECTED){static unsigned long retry=0;if(millis()-retry>12000){retry=millis();WiFi.begin(WIFI_SSID,WIFI_PASS);}delay(50);return;}
  long cm=measureCm();
  // A new hand entry triggers exactly one topic change; retract hand to re-arm.
  bool near=(cm>=5 && cm<=25);
  if(near && !nearLatched){if(nearSince==0)nearSince=millis();}
  else if(!near){nearSince=0;nearLatched=false;}
  bool swipe=false;
  if(near && !nearLatched && nearSince && millis()-nearSince>=180 && millis()-lastGesture>1500){swipe=true;nearLatched=true;lastGesture=millis();}
  if(millis()-lastPost>=900 || swipe){lastPost=millis();Serial.print("Distance: ");Serial.println(cm);sendTelemetry(cm,swipe?"SWIPE":near?"NEAR":"WAITING");}
  delay(45);
}
