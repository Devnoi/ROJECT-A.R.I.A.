#include <WiFiS3.h>
#include <Arduino_LED_Matrix.h>

// Enter your own credentials. NEVER commit real secrets to public GitHub.
const char WIFI_SSID[] = "YOUR_WIFI_NAME";
const char WIFI_PASS[] = "YOUR_WIFI_PASSWORD";
const char CLOUD_HOST[] = "roject-a-r-i-a.onrender.com"; // no https:// and no slash
const char DEVICE_TOKEN[] = "REPLACE_WITH_RENDER_DEVICE_TOKEN";
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

WiFiSSLClient client;
ArduinoLEDMatrix matrix;
unsigned long lastPost = 0;
unsigned long lastWifiRetry = 0;
unsigned long lastError = 0;

long readDistance() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long pulse = pulseIn(ECHO_PIN, HIGH, 26000UL);
  if (pulse == 0) return -1;
  return (long)(pulse / 58UL);
}

void sendReading(long cm) {
  if (!client.connect(CLOUD_HOST, 443)) {
    Serial.println("HTTPS FAILED; check host, WiFi, and firmware");
    client.stop();return;
  }
  String payload = "{\"distance\":" + (cm < 0 ? String("null") : String(cm)) + "}";
  client.print("POST /api/device HTTP/1.1\r\nHost: ");client.print(CLOUD_HOST);
  client.print("\r\nUser-Agent: ARIA-Health-R4\r\nContent-Type: application/json\r\nX-Device-Token: ");client.print(DEVICE_TOKEN);
  client.print("\r\nContent-Length: ");client.print(payload.length());
  client.print("\r\nConnection: close\r\n\r\n");client.print(payload);
  unsigned long start=millis();String firstLine="";bool gotLine=false;
  while(millis()-start<4500){
    while(client.available()){
      char c=client.read();
      if(!gotLine){if(c=='\n'){gotLine=true;Serial.print("HTTP: ");Serial.println(firstLine);}else if(c!='\r'&&firstLine.length()<100)firstLine+=c;}
    }
    if(!client.connected()&&!client.available())break;
    delay(4);
  }
  client.stop();
  if(!gotLine)Serial.println("No HTTP response");
  if(firstLine.indexOf(" 401 ")>=0)Serial.println("DEVICE_TOKEN not matching Render");
}

void setup(){
  Serial.begin(115200);
  pinMode(TRIG_PIN,OUTPUT);pinMode(ECHO_PIN,INPUT);
  matrix.begin();
  WiFi.begin(WIFI_SSID,WIFI_PASS);
  Serial.println("A.R.I.A. Health Greeter starting...");
}
void loop(){
  if(WiFi.status()!=WL_CONNECTED){
    if(millis()-lastWifiRetry>10000){lastWifiRetry=millis();Serial.println("Retry WiFi...");WiFi.begin(WIFI_SSID,WIFI_PASS);}
    delay(50);return;
  }
  // Backend confirms the 10 cm entry after two consecutive readings.
  if(millis()-lastPost>=750){
    lastPost=millis();long cm=readDistance();
    Serial.print("Distance: ");Serial.println(cm);
    sendReading(cm);
  }
  delay(20);
}
