// Garanta que esta definição do modem esteja no topo, antes de qualquer inclusão do TinyGSM!
#define TINY_GSM_MODEM_SIM800

#include <HardwareSerial.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <TinyGPSPlus.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// --- Definições de pinos do TTGO T-Call ---
#define MODEM_RST 5
#define MODEM_PWKEY 4
#define MODEM_POWER_ON 23
#define MODEM_TX 27
#define MODEM_RX 26
#define I2C_SDA 21
#define I2C_SCL 22

// --- Saídas ---
#define OUT_PIN 2      // BLOQUEIO 
#define LED_PIN_MQTT 13 // Exemplo de pino para LED de status

// --- Pinos do Módulo GPS (Usando Serial2 para Neo-M8N) ---
#define GPS_RX_PIN 12
#define GPS_TX_PIN 15

// --- Variáveis de comunicação GPRS ---
const char apn[] = "zap.vivo.com.br";
const char gprsUser[] = "";
const char gprsPass[] = "";

// --- DADOS DO BROKER MQTT ---
const char mqtt_broker[] = "broker.hivemq.com";
const int mqtt_port = 1883;
const char mqtt_username[] = "";
const char mqtt_password[] = "";

// --- Variáveis de comunicação MQTT ---
String mqtt_client_id = "";
String mqtt_subscribe_topic = "";
String mqtt_publish_topic = "";
String mqtt_location_topic = "";
String mqtt_status_topic = "";
String mqtt_command_topic = "";

// --- Objetos de Comunicação ---
#define SerialMon Serial
#define SerialAT Serial1
HardwareSerial SerialGPS(2);

TinyGsm modem(SerialAT);
TinyGsmClient gsmClient(modem);
PubSubClient mqttClient(gsmClient);
TinyGPSPlus gps;
Preferences preferences;

// --- Variáveis de Tempo e Limites ---
unsigned long lastGPSpublishTime = 0;
const long gpsPublishInterval = 30000; // Reduzido para 30 segundos para testes
unsigned long lastBatteryCheckTime = 0;
const long batteryCheckInterval = 60000;
const int BATTERY_LOW_THRESHOLD = 20;

// --- Variáveis de status ---
bool relayState = false;
int lastBatteryLevel = -1;
int lastSignalStrength = -1;

// --- Função para manter a energia da bateria (chip IP5306) ---
bool setPowerBoostKeepOn(int en) {
  Wire.beginTransmission(0x75);
  Wire.write(0x06);
  if (en) {
    Wire.write(0x41);
  } else {
    Wire.write(0x40);
  }
  return Wire.endTransmission() == 0;
}

// --- Função para ler o nível da bateria via IP5306 ---
int getBatteryLevel() {
  Wire.beginTransmission(0x75);
  Wire.write(0x78);
  Wire.endTransmission(false);
  Wire.requestFrom(0x75, 1);
  if (Wire.available()) {
    uint8_t data = Wire.read();
    return (int)((data & 0x0F) * 6.25);
  }
  return -1;
}

// --- Função para obter força do sinal GSM ---
int getSignalStrength() {
  if (modem.isNetworkConnected()) {
    return modem.getSignalQuality();
  }
  return -1;
}

// --- Função para criar payload JSON ---
String createLocationPayload(float latitude, float longitude, float speed = 0.0) {
  DynamicJsonDocument doc(512);
  
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  doc["timestamp"] = millis();
  doc["velocidade"] = speed;
  doc["bateria"] = getBatteryLevel();
  doc["sinal"] = getSignalStrength();
  doc["status"] = "online";
  
  String payload;
  serializeJson(doc, payload);
  return payload;
}

String createStatusPayload() {
  DynamicJsonDocument doc(256);
  
  doc["status"] = "online";
  doc["bateria"] = getBatteryLevel();
  doc["sinal"] = getSignalStrength();
  doc["relay"] = relayState ? "ON" : "OFF";
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  return payload;
}

// --- Função de callback para mensagens MQTT recebidas ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  SerialMon.print("Mensagem MQTT recebida no topico: ");
  SerialMon.println(topic);
  SerialMon.print("Payload: ");
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  SerialMon.println(message);

  // Verificar se é um comando para este rastreador
  if (String(topic) == mqtt_command_topic) {
    if (message == "ON" || message == "bloqueio") {
      digitalWrite(LED_PIN_MQTT, HIGH);
      digitalWrite(OUT_PIN, HIGH);
      relayState = true;
      SerialMon.println("Rele ativado (BLOQUEADO)");
      
      // Publicar confirmação
      String response = "{\"comando\":\"bloqueio\",\"status\":\"executado\",\"relay\":\"ON\"}";
      mqttClient.publish(mqtt_publish_topic.c_str(), response.c_str());
      preferences.putBool("relay_state", true);
      
    } else if (message == "OFF" || message == "desbloqueio") {
      digitalWrite(LED_PIN_MQTT, LOW);
      digitalWrite(OUT_PIN, LOW);
      relayState = false;
      SerialMon.println("Rele desativado (DESBLOQUEADO)");
      
      // Publicar confirmação
      String response = "{\"comando\":\"desbloqueio\",\"status\":\"executado\",\"relay\":\"OFF\"}";
      mqttClient.publish(mqtt_publish_topic.c_str(), response.c_str());
      preferences.putBool("relay_state", false);
      
    } else if (message == "status") {
      // Solicitação de status
      String statusPayload = createStatusPayload();
      mqttClient.publish(mqtt_status_topic.c_str(), statusPayload.c_str());
      SerialMon.println("Status enviado via MQTT");
      
    } else {
      SerialMon.println("Comando desconhecido recebido.");
      String response = "{\"erro\":\"comando_desconhecido\",\"comando\":\"" + message + "\"}";
      mqttClient.publish(mqtt_publish_topic.c_str(), response.c_str());
    }
  }
}

// --- Função para conectar ao broker MQTT ---
void connectMqtt() {
  SerialMon.println("Conectando ao broker MQTT...");
  while (!mqttClient.connected()) {
    SerialMon.print("Tentando conexao MQTT...");
    if (mqttClient.connect(mqtt_client_id.c_str(), mqtt_username, mqtt_password)) {
      SerialMon.println(" Conectado!");
      
      // Inscrever no tópico de comandos
      mqttClient.subscribe(mqtt_command_topic.c_str());
      SerialMon.print("Assinado ao topico: ");
      SerialMon.println(mqtt_command_topic);
      
      // Publicar status inicial
      String statusPayload = createStatusPayload();
      mqttClient.publish(mqtt_status_topic.c_str(), statusPayload.c_str());
      
      digitalWrite(LED_PIN_MQTT, HIGH);
    } else {
      SerialMon.print(" falhou, rc=");
      SerialMon.print(mqttClient.state());
      SerialMon.println(" tentando novamente em 5 segundos");
      digitalWrite(LED_PIN_MQTT, LOW);
      delay(5000);
    }
  }
}

// --- Setup: Inicialização do Dispositivo ---
void setup() {
  SerialMon.begin(115200);
  delay(10);
  SerialMon.println("Iniciando TTGO T-Call com Controle de Rele/LED via MQTT e GPS...");

  pinMode(OUT_PIN, OUTPUT);
  pinMode(LED_PIN_MQTT, OUTPUT);
  digitalWrite(LED_PIN_MQTT, LOW);

  preferences.begin("device-data", false);
  
  // Tenta ler o número de série da NVS
  mqtt_client_id = preferences.getString("serial_num", "RAST001");
  
  if (mqtt_client_id == "RAST001") {
      SerialMon.println("AVISO: NUMERO DE SERIE PADRAO LIDO. POR FAVOR, GRAVE UM NOVO ID.");
  } else {
      SerialMon.print("Numero de Serie lido da NVS: ");
      SerialMon.println(mqtt_client_id);
  }

  // Com o ID único em mãos, constrói os tópicos dinamicamente
  // Usando o formato esperado pelo app: rastreadores/{id}/...
  String base_topic = "rastreadores/" + mqtt_client_id;
  mqtt_command_topic = base_topic + "/comando";
  mqtt_publish_topic = base_topic + "/status";
  mqtt_location_topic = base_topic + "/localizacao";
  mqtt_status_topic = base_topic + "/status";
  
  SerialMon.println("Topicos MQTT configurados:");
  SerialMon.println("Comando: " + mqtt_command_topic);
  SerialMon.println("Status: " + mqtt_status_topic);
  SerialMon.println("Localizacao: " + mqtt_location_topic);
  
  bool lastRelayState = preferences.getBool("relay_state", false);
  relayState = lastRelayState;
  digitalWrite(OUT_PIN, lastRelayState);
  if (lastRelayState) {
    SerialMon.println("Estado inicial do rele restaurado: LIGADO.");
  } else {
    SerialMon.println("Estado inicial do rele restaurado: DESBLOQUEADO.");
  }

  Wire.begin(I2C_SDA, I2C_SCL);
  bool isOk = setPowerBoostKeepOn(1);
  SerialMon.println(String("IP5306 KeepOn ") + (isOk ? "OK" : "FALHA"));

  pinMode(MODEM_PWKEY, OUTPUT);
  pinMode(MODEM_RST, OUTPUT);
  pinMode(MODEM_POWER_ON, OUTPUT);

  digitalWrite(MODEM_PWKEY, LOW);
  digitalWrite(MODEM_RST, HIGH);
  digitalWrite(MODEM_POWER_ON, HIGH);

  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(3000);

  SerialMon.println("Inicializando modem...");
  if (!modem.restart()) {
    SerialMon.println("Falha ao reiniciar o modem. Tentando inicializar...");
    if (!modem.init()) {
      SerialMon.println("Falha total ao inicializar o modem. Verifique a energia e as conexoes.");
      while (true) {
        delay(1000);
      }
    }
  }

  String modemInfo = modem.getModemInfo();
  SerialMon.print("Informacoes do Modem: ");
  SerialMon.println(modemInfo);

  SerialMon.print("Aguardando rede...");
  if (!modem.waitForNetwork(240000L)) {
    SerialMon.println(" falhou - Nenhuma rede encontrada.");
  } else {
    SerialMon.println(" OK - Rede conectada!");
    if (modem.isNetworkConnected()) {
      SerialMon.println("Modulo registrado na rede.");
    }
  }

  SerialMon.println("Conectando GPRS...");
  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    SerialMon.println("Falha ao conectar GPRS! Tentando novamente no loop.");
  } else {
    SerialMon.println("GPRS Conectado.");
  }

  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  SerialMon.print("Serial GPS inicializada em RX: ");
  SerialMon.print(GPS_RX_PIN);
  SerialMon.print(", TX: ");
  SerialMon.println(GPS_TX_PIN);

  mqttClient.setCallback(mqttCallback);
  mqttClient.setServer(mqtt_broker, mqtt_port);
  connectMqtt();

  SerialMon.println("Configuracao completa. Aguardando comandos MQTT e dados GPS...");
}

// --- Loop: Operação Contínua ---
void loop() {
  if (!modem.isGprsConnected()) {
    SerialMon.println("GPRS desconectado. Tentando reconectar GPRS...");
    digitalWrite(LED_PIN_MQTT, LOW);
    if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
      SerialMon.println("Falha ao reconectar GPRS. Tentando novamente em 5 segundos...");
      delay(5000);
      return;
    } else {
      SerialMon.println("GPRS Reconectado.");
    }
  }

  if (!mqttClient.connected()) {
    SerialMon.println("MQTT desconectado. Tentando reconectar...");
    digitalWrite(LED_PIN_MQTT, LOW);
    connectMqtt();
  }

  mqttClient.loop();

  // Processar dados GPS
  while (SerialGPS.available()) {
    gps.encode(SerialGPS.read());
  }

  // Publicar dados GPS quando disponíveis
  if (gps.location.isUpdated() && (millis() - lastGPSpublishTime > gpsPublishInterval)) {
    if (gps.location.isValid()) {
      float latitude = gps.location.lat();
      float longitude = gps.location.lng();
      float speed = gps.speed.kmph();

      SerialMon.print("Latitude: ");
      SerialMon.print(latitude, 6);
      SerialMon.print(", Longitude: ");
      SerialMon.print(longitude, 6);
      SerialMon.print(", Velocidade: ");
      SerialMon.print(speed);
      SerialMon.println(" km/h");

      if (mqttClient.connected()) {
        String locationPayload = createLocationPayload(latitude, longitude, speed);
        mqttClient.publish(mqtt_location_topic.c_str(), locationPayload.c_str());
        SerialMon.println("Dados GPS publicados no MQTT.");
      } else {
        SerialMon.println("Cliente MQTT nao conectado, nao e possivel publicar dados GPS.");
      }
      
      lastGPSpublishTime = millis();
    } else {
      SerialMon.println("Localizacao GPS nao valida (sem correcao ou dados invalidos).");
    }
  }

  // Verificar bateria e sinal periodicamente
  if (millis() - lastBatteryCheckTime > batteryCheckInterval) {
    int batteryLevel = getBatteryLevel();
    int signalStrength = getSignalStrength();
    
    // Só publicar se houve mudança significativa
    bool shouldPublish = false;
    
    if (batteryLevel != -1 && abs(batteryLevel - lastBatteryLevel) >= 5) {
      SerialMon.print("Nivel da Bateria: ");
      SerialMon.print(batteryLevel);
      SerialMon.println("%");
      lastBatteryLevel = batteryLevel;
      shouldPublish = true;
      
      if (batteryLevel <= BATTERY_LOW_THRESHOLD) {
        SerialMon.println("ALERTA: Bateria baixa!");
        String alertPayload = "{\"tipo\":\"bateria_baixa\",\"nivel\":" + String(batteryLevel) + "}";
        mqttClient.publish(mqtt_publish_topic.c_str(), alertPayload.c_str());
      }
    }
    
    if (signalStrength != -1 && abs(signalStrength - lastSignalStrength) >= 5) {
      SerialMon.print("Forca do Sinal: ");
      SerialMon.print(signalStrength);
      SerialMon.println("%");
      lastSignalStrength = signalStrength;
      shouldPublish = true;
    }
    
    // Publicar status atualizado se necessário
    if (shouldPublish && mqttClient.connected()) {
      String statusPayload = createStatusPayload();
      mqttClient.publish(mqtt_status_topic.c_str(), statusPayload.c_str());
    }
    
    lastBatteryCheckTime = millis();
  }

  // Indicador de status via LED
  if (modem.isGprsConnected() && mqttClient.connected()) {
    digitalWrite(LED_PIN_MQTT, HIGH);
  } else {
    digitalWrite(LED_PIN_MQTT, LOW);
  }
  
  // Pequeno delay para estabilidade
  delay(100);
}
}