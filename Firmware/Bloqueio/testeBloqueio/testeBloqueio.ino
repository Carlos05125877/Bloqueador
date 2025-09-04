// Garanta que esta definição do modem esteja no topo, antes de qualquer inclusão do TinyGSM!
#define TINY_GSM_MODEM_SIM800

#include <HardwareSerial.h> // Para Serial, Serial1, Serial2
#include <TinyGsmClient.h>  // Biblioteca para o modem SIM800L
#include <PubSubClient.h>   // Biblioteca para o cliente MQTT
#include <Wire.h>           // Para comunicação I2C (usado pelo IP5306)
#include <TinyGPSPlus.h>    // Biblioteca para o módulo GPS
#include <Preferences.h>    // Para persistência de dados no ESP32 (NVS)
#include <ArduinoJson.h>    // Para parsing de JSON

// --- Definições de pinos do TTGO T-Call ---
#define MODEM_RST       5
#define MODEM_PWKEY     4
#define MODEM_POWER_ON  23
#define MODEM_TX        27 // GPIO27 para SIM800L TX (do ESP32 para SIM800L RX)
#define MODEM_RX        26 // GPIO26 para SIM800L RX (do SIM800L TX para ESP32 RX)
#define I2C_SDA         21
#define I2C_SCL         22

// --- Saídas ---
#define OUT_PIN         2   // BLOQUEIO  
#define LED_PIN_MQTT    13   

// --- Pinos do Módulo GPS (Usando Serial2 para Neo-M8N) ---
#define GPS_RX_PIN      12 // Pino RX para o GPS (conecte ao TX do GPS)
#define GPS_TX_PIN      15 // Pino TX para o GPS (conecte ao RX do GPS)

// --- Variáveis de comunicação GPRS ---
const char apn[] = "zap.vivo.com.br"; // Seu APN
const char gprsUser[] = "";
const char gprsPass[] = "";

// --- DADOS DO BROKER MQTT ---
const char mqtt_broker[] = "broker.hivemq.com"; // Exemplo de um broker MQTT público e gratuito para testes
const int mqtt_port = 1883;                   // Porta padrão para MQTT (não segura)
const char mqtt_username[] = "";              // Usuário (deixe vazio para a maioria dos brokers de teste públicos)
const char mqtt_password[] = "";              // Senha (deixe vazio para a maioria dos brokers de teste públicos)
const char mqtt_client_id[] = "ContourlineRastrador0407250001"; // ID único para o seu cliente MQTT

// --- Tópicos MQTT ---
// Usando o formato padronizado: rastreadores/{ID}/...
const char mqtt_command_topic[] = "rastreadores/0407250001/comando";     // Para receber comandos
const char mqtt_status_topic[] = "rastreadores/0407250001/status";       // Para publicar status
const char mqtt_location_topic[] = "rastreadores/0407250001/localizacao"; // Para publicar dados GPS
const char mqtt_pending_topic[] = "rastreadores/0407250001/comandos_pendentes"; // Comandos pendentes
const char mqtt_execution_status_topic[] = "rastreadores/0407250001/execucao"; // Status de execução

// --- Objetos de Comunicação ---
#define SerialMon Serial  // Monitor Serial via USB (usará GPIO1/3)
#define SerialAT Serial1  // Modem SIM800L (usará GPIO26/27)
HardwareSerial SerialGPS(2); // Módulo GPS (usará GPIO12/15 para Serial2)

TinyGsm modem(SerialAT);      // Instância do modem para SIM800L
TinyGsmClient gsmClient(modem);     // Cliente TCP/IP usando o modem
PubSubClient mqttClient(gsmClient); // Cliente MQTT usando o cliente TCP/IP
TinyGPSPlus gps;              // Instância GPS para analisar dados NMEA
Preferences preferences;      // Instância para gerenciar as preferências persistentes

// --- Variáveis de Tempo e Limites ---
unsigned long lastGPSpublishTime = 0;
// Publicar dados GPS a cada 1 minuto e 30 segundos (90000 ms)
const long gpsPublishInterval = 90000; 

unsigned long lastBatteryCheckTime = 0;
const long batteryCheckInterval = 60000; // Verificar a bateria a cada 1 minuto (60000 ms)

const int BATTERY_LOW_THRESHOLD = 20; // Porcentagem de bateria para considerar "baixa"

// --- Variáveis para comandos pendentes ---
unsigned long lastPendingCommandCheck = 0;
const long pendingCommandCheckInterval = 10000; // Verificar comandos pendentes a cada 10 segundos
bool pendingCommandsProcessed = false; // Flag para controlar se já processamos comandos pendentes na sessão atual

// --- Estrutura para comando pendente ---
struct PendingCommand {
  String command;
  String timestamp;
  String id;
  bool processed;
};

PendingCommand lastPendingCommand;

// --- Função para manter a energia da bateria (chip IP5306) ---
// Garante que o chip de gerenciamento de energia IP5306 mantenha o ESP32 energizado.
bool setPowerBoostKeepOn(int en) {
  Wire.beginTransmission(0x75); // Endereço do chip IP5306
  Wire.write(0x06);             // Registro IP5306 REG_SYS_CTL0
  if (en) {
    Wire.write(0x41); // Define BIT6 para habilitar a saída de 5V (manter ligado)
  } else {
    Wire.write(0x40); // Limpa BIT6 para desabilitar a saída de 5V
  }
  return Wire.endTransmission() == 0; // Retorna verdadeiro se a transmissão foi bem-sucedida
}

// --- Função para ler o nível da bateria via IP5306 ---
// Retorna a porcentagem da bateria (0-100%) ou -1 em caso de erro.
int getBatteryLevel() {
    Wire.beginTransmission(0x75); // Endereço I2C do IP5306
    Wire.write(0x78);             // Registrador para ler o nível da bateria
    Wire.endTransmission(false);  // Não pare a transmissão, vamos ler
    Wire.requestFrom(0x75, 1);    // Solicita 1 byte do registrador 0x78

    if (Wire.available()) {
        uint8_t data = Wire.read();
        // O IP5306 retorna um valor de 0 a 16 para 0% a 100%.
        // Cada unidade representa aproximadamente 6.25% (100 / 16).
        // A máscara (data & 0x0F) pega apenas os 4 bits menos significativos que contêm o nível.
        return (int)((data & 0x0F) * 6.25);
    }
    return -1; // Erro na leitura
}

// --- Função para executar comando de bloqueio/desbloqueio ---
void executeCommand(String command) {
  SerialMon.print("Executando comando: ");
  SerialMon.println(command);
  
  // Tenta extrair ID do comando se for JSON
  String commandId = "";
  if (command.startsWith("{")) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, command);
    if (!error && doc.containsKey("id")) {
      commandId = doc["id"].as<String>();
      command = doc["command"].as<String>(); // Extrai o comando real
      SerialMon.print("ID do comando: ");
      SerialMon.println(commandId);
    }
  }
  
  if (command == "ON" || command == "bloqueio") {
    digitalWrite(OUT_PIN, HIGH); // Ativa OUT_PIN (ex: para bloquear um veículo)
    SerialMon.println("Relé ativado (BLOQUEADO)");
    preferences.putBool("relay_state", true); // Salva o estado "ON"
    
    // Publica status no formato esperado pelo app
    String statusPayload = "{\"status\":\"online\",\"relay\":\"ON\",\"comando\":\"bloqueio\",\"resultado\":\"executado\",\"timestamp\":" + String(millis()) + "}";
    mqttClient.publish(mqtt_status_topic, statusPayload.c_str());
    
    // Envia confirmação com ID se disponível
    if (commandId != "") {
      DynamicJsonDocument confirmDoc(256);
      confirmDoc["status"] = "executed";
      confirmDoc["command_id"] = commandId;
      confirmDoc["device_id"] = mqtt_client_id;
      confirmDoc["timestamp"] = millis();
      
      String confirmationMessage;
      serializeJson(confirmDoc, confirmationMessage);
      mqttClient.publish(mqtt_execution_status_topic, confirmationMessage.c_str());
      SerialMon.println("Confirmação enviada com ID: " + commandId);
    }
    
  } else if (command == "OFF" || command == "desbloqueio") {
    digitalWrite(OUT_PIN, LOW);  // Desativa OUT_PIN (ex: para desbloquear um veículo)
    SerialMon.println("Relé desativado (DESBLOQUEADO)");
    preferences.putBool("relay_state", false); // Salva o estado "OFF"
    
    // Publica status no formato esperado pelo app
    String statusPayload = "{\"status\":\"online\",\"relay\":\"OFF\",\"comando\":\"desbloqueio\",\"resultado\":\"executado\",\"timestamp\":" + String(millis()) + "}";
    mqttClient.publish(mqtt_status_topic, statusPayload.c_str());
    
    // Envia confirmação com ID se disponível
    if (commandId != "") {
      DynamicJsonDocument confirmDoc(256);
      confirmDoc["status"] = "executed";
      confirmDoc["command_id"] = commandId;
      confirmDoc["device_id"] = mqtt_client_id;
      confirmDoc["timestamp"] = millis();
      
      String confirmationMessage;
      serializeJson(confirmDoc, confirmationMessage);
      mqttClient.publish(mqtt_execution_status_topic, confirmationMessage.c_str());
      SerialMon.println("Confirmação enviada com ID: " + commandId);
    }
    
  } else if (command == "status") {
    // Solicitação de status - envia informações completas
    String statusPayload = "{\"status\":\"online\",\"relay\":\"" + (digitalRead(OUT_PIN) == HIGH ? "ON" : "OFF") + "\",\"bateria\":" + String(getBatteryLevel()) + ",\"timestamp\":" + String(millis()) + "}";
    mqttClient.publish(mqtt_status_topic, statusPayload.c_str());
    SerialMon.println("Status enviado via MQTT");
    
  } else {
    SerialMon.println("Comando desconhecido recebido.");
    
    // Publica status de erro no formato esperado
    String errorPayload = "{\"status\":\"erro\",\"comando\":\"" + command + "\",\"erro\":\"comando_desconhecido\",\"timestamp\":" + String(millis()) + "}";
    mqttClient.publish(mqtt_status_topic, errorPayload.c_str());
  }
}

// --- Função para verificar comandos pendentes ---
void checkPendingCommands() {
  if (!mqttClient.connected()) {
    return; // Só verifica se estiver conectado
  }
  
  // Publica uma mensagem solicitando comandos pendentes
  DynamicJsonDocument requestDoc(256);
  requestDoc["action"] = "request_pending";
  requestDoc["device_id"] = mqtt_client_id;
  requestDoc["timestamp"] = millis();
  
  String requestMessage;
  serializeJson(requestDoc, requestMessage);
  mqttClient.publish(mqtt_pending_topic, requestMessage.c_str());
  
  SerialMon.println("Solicitando verificação de comandos pendentes...");
}

// --- Função para processar comando pendente ---
void processPendingCommand(String jsonCommand) {
  SerialMon.print("Processando comando pendente: ");
  SerialMon.println(jsonCommand);
  
  // Parse do JSON
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, jsonCommand);
  
  if (error) {
    SerialMon.print("Erro ao parsear JSON: ");
    SerialMon.println(error.c_str());
    return;
  }
  
  // Extrai informações do comando
  if (doc.containsKey("command") && doc.containsKey("timestamp") && doc.containsKey("id")) {
    String command = doc["command"].as<String>();
    String timestamp = doc["timestamp"].as<String>();
    String id = doc["id"].as<String>();
    
    // Verifica se já processamos este comando
    if (id == lastPendingCommand.id && lastPendingCommand.processed) {
      SerialMon.println("Comando já foi processado anteriormente. Ignorando...");
      return;
    }
    
    // Marca como processado
    lastPendingCommand.command = command;
    lastPendingCommand.timestamp = timestamp;
    lastPendingCommand.id = id;
    lastPendingCommand.processed = true;
    
    // Executa o comando
    executeCommand(command);
    
    // Confirma processamento do comando pendente
    DynamicJsonDocument confirmDoc(256);
    confirmDoc["status"] = "processed";
    confirmDoc["command_id"] = id;
    confirmDoc["device_id"] = mqtt_client_id;
    confirmDoc["timestamp"] = millis();
    
    String confirmationMessage;
    serializeJson(confirmDoc, confirmationMessage);
    mqttClient.publish(mqtt_pending_topic, confirmationMessage.c_str());
    
    SerialMon.println("Comando pendente processado com sucesso!");
  }
}

// --- Função de callback para mensagens MQTT recebidas ---
// Chamada sempre que uma mensagem é recebida em um tópico MQTT assinado.
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  SerialMon.print("Mensagem MQTT recebida no tópico: ");
  SerialMon.println(topic);
  SerialMon.print("Payload: ");
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i]; // Converte bytes do payload para uma String
  }
  SerialMon.println(message);

  // Verifica o tópico e processa a mensagem
  if (String(topic) == mqtt_command_topic) {
    // Comando direto - executa imediatamente
    executeCommand(message);
    
  } else if (String(topic) == mqtt_pending_topic) {
    // Comando pendente - processa se for um comando válido
    if (message.indexOf("\"command\"") != -1) {
      processPendingCommand(message);
    }
  }
}

// --- Função para conectar ao broker MQTT ---
// Tenta conectar ao broker MQTT e assina o tópico de comando.
void connectMqtt() {
  SerialMon.println("Conectando ao broker MQTT...");
  // Loop até conectar
  while (!mqttClient.connected()) {
    SerialMon.print("Tentando conexão MQTT...");
    if (mqttClient.connect(mqtt_client_id, mqtt_username, mqtt_password)) {
      SerialMon.println(" Conectado!");
      mqttClient.subscribe(mqtt_command_topic);
      mqttClient.subscribe(mqtt_pending_topic); // Assina tópico de comandos pendentes
      SerialMon.print("Assinado aos tópicos: ");
      SerialMon.print(mqtt_command_topic);
      SerialMon.print(" e ");
      SerialMon.println(mqtt_pending_topic);
      digitalWrite(LED_PIN_MQTT, HIGH); // Liga o LED de status MQTT para indicar conexão
    } else {
      SerialMon.print(" falhou, rc=");
      SerialMon.print(mqttClient.state()); // Imprime o estado do cliente MQTT (código de erro)
      SerialMon.println(" tentando novamente em 5 segundos");
      digitalWrite(LED_PIN_MQTT, LOW); // Desliga o LED de status MQTT para indicar desconexão
      delay(5000); // Espera 5 segundos antes de tentar novamente
    }
  }
}

// --- Setup: Inicialização do Dispositivo ---
void setup()
{
  // Inicializa o Monitor Serial (USB)
  SerialMon.begin(115200);
  delay(10);
  SerialMon.println("Iniciando TTGO T-Call com Controle de Relé/LED via MQTT e GPS...");
  SerialMon.println("Sistema de Comandos Pendentes Ativado!");

  // Configura OUT_PIN como saída
  pinMode(OUT_PIN, OUTPUT);
  pinMode(LED_PIN_MQTT, OUTPUT); // Configura o LED de status MQTT

  digitalWrite(LED_PIN_MQTT, LOW); // Inicia o LED de status MQTT DESLIGADO

  // Inicializa as preferências para persistência de dados
  preferences.begin("my-app", false); // "my-app" é o namespace, false para modo R/W

  // Lê o último estado salvo para o relé/OUT_PIN
  // O segundo argumento (true) é o valor padrão se a chave não for encontrada (primeira vez)
  bool lastRelayState = preferences.getBool("relay_state", true); // Por padrão, inicia LIGADO

  if (lastRelayState) {
    digitalWrite(OUT_PIN, HIGH);
    SerialMon.println("Estado inicial do relé restaurado: LIGADO.");
  } else {
    digitalWrite(OUT_PIN, LOW);
    SerialMon.println("Estado inicial do relé restaurado: DESBLOQUEADO.");
  }

  // Inicializa I2C para o chip de gerenciamento de energia IP5306
  Wire.begin(I2C_SDA, I2C_SCL);
  bool isOk = setPowerBoostKeepOn(1); // Chama a função para manter a energia ligada
  SerialMon.println(String("IP5306 KeepOn ") + (isOk ? "OK" : "FALHA"));

  // Configura os pinos de energia do modem como saídas
  pinMode(MODEM_PWKEY, OUTPUT);
  pinMode(MODEM_RST, OUTPUT);
  pinMode(MODEM_POWER_ON, OUTPUT);

  // Liga o modem
  digitalWrite(MODEM_PWKEY, LOW); // Garante que PWKEY esteja baixo inicialmente
  digitalWrite(MODEM_RST, HIGH);
  digitalWrite(MODEM_POWER_ON, HIGH);

  // Inicializa Serial1 para comunicação com o modem (SIM800L)
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(3000); // Dá tempo para o modem inicializar

  SerialMon.println("Inicializando modem...");
  if (!modem.restart()) {
    SerialMon.println("Falha ao reiniciar o modem. Tentando inicializar...");
    if (!modem.init()) {
      SerialMon.println("Falha total ao inicializar o modem. Verifique a energia e as conexões.");
      while (true) { // Para a execução se o modem falhar ao inicializar
        delay(1000);
      }
    }
  }

  String modemInfo = modem.getModemInfo();
  SerialMon.print("Informações do Modem: ");
  SerialMon.println(modemInfo);

  SerialMon.print("Aguardando rede...");
  if (!modem.waitForNetwork(240000L)) { // Espera até 4 minutos pela rede
    SerialMon.println(" falhou - Nenhuma rede encontrada.");
  } else {
    SerialMon.println(" OK - Rede conectada!");
    if (modem.isNetworkConnected()) {
      SerialMon.println("Módulo registrado na rede.");
    }
  }

  SerialMon.println("Conectando GPRS...");
  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    SerialMon.println("Falha ao conectar GPRS! Tentando novamente no loop.");
  } else {
    SerialMon.println("GPRS Conectado.");
  }

  // Inicializa Serial2 para comunicação GPS (Neo-M8N)
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  SerialMon.print("Serial GPS inicializada em RX: ");
  SerialMon.print(GPS_RX_PIN);
  SerialMon.print(", TX: ");
  SerialMon.println(GPS_TX_PIN);

  // Define a função de callback para mensagens MQTT
  mqttClient.setCallback(mqttCallback);
  // Define o servidor e a porta do broker MQTT
  mqttClient.setServer(mqtt_broker, mqtt_port);
  // Tenta a conexão MQTT inicial
  connectMqtt(); // Esta função ligará o LED_PIN_MQTT se for bem-sucedida

  // Inicializa variáveis de comandos pendentes
  lastPendingCommandCheck = millis();
  pendingCommandsProcessed = false;

  SerialMon.println("Configuração completa. Aguardando comandos MQTT, comandos pendentes e dados GPS...");
  SerialMon.println("Tópicos MQTT configurados:");
  SerialMon.println("Comando: " + String(mqtt_command_topic));
  SerialMon.println("Status: " + String(mqtt_status_topic));
  SerialMon.println("Localizacao: " + String(mqtt_location_topic));
}

// --- Loop: Operação Contínua ---
void loop()
{
  // --- Verificação e Reconexão GPRS ---
  if (!modem.isGprsConnected()) {
    SerialMon.println("GPRS desconectado. Tentando reconectar GPRS...");
    digitalWrite(LED_PIN_MQTT, LOW); // Indica problema GPRS/MQTT
    if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
      SerialMon.println("Falha ao reconectar GPRS. Tentando novamente em 5 segundos...");
      delay(5000); // Espera antes da próxima tentativa de GPRS
      return; // Pula o resto do loop se o GPRS não estiver pronto
    } else {
      SerialMon.println("GPRS Reconectado.");
    }
  }

  // --- Verificação e Reconexão MQTT ---
  if (!mqttClient.connected()) {
    SerialMon.println("MQTT desconectado. Tentando reconectar...");
    digitalWrite(LED_PIN_MQTT, LOW); // Garante que o LED esteja DESLIGADO enquanto desconectado
    connectMqtt(); // Esta função ligará o LED_PIN_MQTT se for bem-sucedida
    
    // Reseta flag de comandos pendentes processados ao reconectar
    pendingCommandsProcessed = false;
  }

  // --- Processamento de Mensagens MQTT ---
  mqttClient.loop(); // Mantém a conexão MQTT e processa as mensagens recebidas

  // --- Verificação de Comandos Pendentes ---
  if (mqttClient.connected() && !pendingCommandsProcessed && 
      (millis() - lastPendingCommandCheck > pendingCommandCheckInterval)) {
    
    SerialMon.println("Verificando comandos pendentes após reconexão...");
    checkPendingCommands();
    lastPendingCommandCheck = millis();
    
    // Aguarda um pouco para receber resposta
    delay(2000);
    
    // Marca como processado para esta sessão
    pendingCommandsProcessed = true;
  }

  // --- Leitura e Publicação de Dados GPS ---
  while (SerialGPS.available()) {
    gps.encode(SerialGPS.read());
  }

  // Publica dados GPS apenas se houver atualização E o intervalo de tempo foi atingido
  if (gps.location.isUpdated() && (millis() - lastGPSpublishTime > gpsPublishInterval)) {
    if (gps.location.isValid()) { // Verifica se o GPS tem uma correção válida
      float latitude = gps.location.lat();
      float longitude = gps.location.lng();

      // Cria payload JSON completo no formato esperado pelo app
      DynamicJsonDocument doc(512);
      doc["latitude"] = latitude;
      doc["longitude"] = longitude;
      doc["timestamp"] = millis();
      doc["velocidade"] = gps.speed.kmph();
      doc["bateria"] = getBatteryLevel();
      doc["sinal"] = modem.getSignalQuality();
      doc["status"] = "online";
      
      String gpsPayload;
      serializeJson(doc, gpsPayload);

      SerialMon.print("Publicando dados GPS para MQTT: ");
      SerialMon.println(gpsPayload);

      SerialMon.print("Latitude: ");
      SerialMon.print(latitude, 6);
      SerialMon.print(", Longitude: ");
      SerialMon.println(longitude, 6);

      if (mqttClient.connected()) {
        mqttClient.publish(mqtt_location_topic, gpsPayload.c_str());
        SerialMon.println("Dados GPS publicados no MQTT.");
      } else {
        SerialMon.println("Cliente MQTT não conectado, não é possível publicar dados GPS.");
      }
    } else {
      SerialMon.println("Localização GPS não válida (sem correção ou dados inválidos).");
    }
    lastGPSpublishTime = millis(); // Reinicia o temporizador, mesmo sem dados GPS válidos
  }

  // --- Verificação do Nível da Bateria ---
  if (millis() - lastBatteryCheckTime > batteryCheckInterval) {
    int batteryLevel = getBatteryLevel();
    if (batteryLevel != -1) {
      SerialMon.print("Nível da Bateria: ");
      SerialMon.print(batteryLevel);
      SerialMon.println("%");

      if (batteryLevel <= BATTERY_LOW_THRESHOLD) {
        SerialMon.println("ALERTA: Bateria baixa!");
        
        // Publica alerta no formato JSON esperado pelo app
        DynamicJsonDocument alertDoc(256);
        alertDoc["tipo"] = "bateria_baixa";
        alertDoc["nivel"] = batteryLevel;
        alertDoc["timestamp"] = millis();
        alertDoc["status"] = "alerta";
        
        String alertPayload;
        serializeJson(alertDoc, alertPayload);
        mqttClient.publish(mqtt_status_topic, alertPayload.c_str());
      }
    }
    lastBatteryCheckTime = millis();
  }

  // --- Gerenciamento do LED de Status MQTT ---
  if (modem.isGprsConnected() && mqttClient.connected()) {
    digitalWrite(LED_PIN_MQTT, HIGH); // LED LIGADO se GPRS e MQTT estão conectados
  } else {
    digitalWrite(LED_PIN_MQTT, LOW);  // LED DESLIGADO se GPRS ou MQTT estão desconectados
  }
}
