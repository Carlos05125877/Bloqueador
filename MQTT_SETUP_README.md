# Sistema MQTT Otimizado para Rastreadores GPS

## 📋 Visão Geral

Este sistema implementa uma solução completa e otimizada para envio e recebimento de dados de localização dos rastreadores via MQTT, com integração ao Firebase para armazenamento e geração de histórico.

## 🚀 Funcionalidades Principais

### Firmware ESP32 (TTGO T-Call)
- ✅ Conexão GSM/GPRS automática
- ✅ GPS em tempo real
- ✅ Comunicação MQTT otimizada
- ✅ Controle de relé para bloqueio
- ✅ Monitoramento de bateria e sinal
- ✅ Reconexão automática
- ✅ Armazenamento persistente de configurações

### App React Native
- ✅ Interface de localização em tempo real
- ✅ Histórico de localizações com filtros
- ✅ Estatísticas detalhadas
- ✅ Monitoramento de status MQTT
- ✅ Integração com Firebase
- ✅ Processamento em lote otimizado

## 🔧 Configuração do Firmware

### 1. Firmware Base (testeBloqueio.ino)
O firmware principal está localizado em `Firmware/Bloqueio/testeBloqueio/testeBloqueio.ino` e inclui:
- ✅ Sistema de comandos pendentes
- ✅ Controle de relé para bloqueio/desbloqueio
- ✅ GPS em tempo real
- ✅ Monitoramento de bateria e sinal
- ✅ Comunicação MQTT otimizada

### 2. Dependências Necessárias
```cpp
#include <TinyGsmClient.h>      // Cliente GSM
#include <PubSubClient.h>        // Cliente MQTT
#include <TinyGPSPlus.h>         // GPS
#include <ArduinoJson.h>         // JSON
#include <Preferences.h>         // Armazenamento
```

### 3. Configuração MQTT
```cpp
// Broker MQTT (público para testes)
const char mqtt_broker[] = "broker.hivemq.com";
const int mqtt_port = 1883;

// Tópicos padronizados:
// rastreadores/{ID}/localizacao  - Dados de localização
// rastreadores/{ID}/status      - Status do dispositivo
// rastreadores/{ID}/comando     - Comandos recebidos
// rastreadores/{ID}/comandos_pendentes - Comandos pendentes
// rastreadores/{ID}/execucao    - Status de execução
```

### 4. Compilação e Upload
```bash
# Usando PlatformIO (recomendado)
cd Firmware/Bloqueio/testeBloqueio
pio run --target upload --target monitor

# Ou usando Arduino IDE
# 1. Instalar as bibliotecas necessárias
# 2. Selecionar placa TTGO T-Call
# 3. Compilar e fazer upload
```

## 📱 Configuração do App

### 1. Dependências
```json
{
  "dependencies": {
    "mqtt": "^5.13.1",
    "firebase": "^11.10.0",
    "@rnmapbox/maps": "^10.1.39"
  }
}
```

### 2. Configuração Firebase
```javascript
// app/firebase/firebaseConfig.js
const firebaseConfig = {
  apiKey: "sua_api_key",
  authDomain: "seu_projeto.firebaseapp.com",
  projectId: "seu_projeto_id",
  // ... outras configurações
};
```

### 3. Configuração MQTT
```javascript
// app/services/MQTTService.ts
private defaultConfig: MQTTConfig = {
  host: 'broker.hivemq.com',
  port: 1883,
  clientId: `bloqueador_${Date.now()}`,
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 30000
};
```

## 🔄 Fluxo de Dados

### 1. Envio de Localização
```
GPS → Firmware → MQTT → App → Firebase
```

### 2. Comandos de Controle
```
App → MQTT → Firmware → Relé
```

### 3. Status e Monitoramento
```
Firmware → MQTT → App → Interface
```

### 4. Consistência de Dados
```
Firebase (rastradores) → Todas as Telas (Localização, Bloqueio, Histórico)
MQTT (dados em tempo real) → Atualização automática das telas
```

## 📊 Estrutura de Dados

### Dados de Localização
```json
{
  "latitude": -19.479220,
  "longitude": -44.247699,
  "timestamp": 1640995200000,
  "velocidade": 45.5,
  "bateria": 85,
  "sinal": 75,
  "status": "online"
}
```

### Comandos
```json
{
  "comando": "bloqueio",
  "status": "executado",
  "relay": "ON",
  "timestamp": 1640995200000
}
```

## 🧪 Testes e Validação

### 1. Teste do Firmware (testeBloqueio.ino)
```bash
# Monitorar serial
cd Firmware/Bloqueio/testeBloqueio
pio device monitor

# Verificar logs:
# ✅ MQTT conectado com sucesso
# ✅ Inscrito aos tópicos: rastreadores/0407250001/comando e comandos_pendentes
# ✅ Dados GPS publicados no MQTT
# ✅ Sistema de comandos pendentes ativado
# ✅ Tópicos MQTT configurados corretamente
```

### 2. Teste do App
```bash
# Verificar conexão MQTT
# ✅ Status: Conectado
# ✅ Fila: 0
# ✅ Cache: 0

# Verificar dados no Firebase
# ✅ Histórico sendo salvo
# ✅ Estatísticas calculadas
```

### 3. Teste de Comandos
```bash
# Enviar comando de bloqueio
mosquitto_pub -h broker.hivemq.com -t "rastreadores/0407250001/comando" -m "bloqueio"

# Verificar resposta
mosquitto_sub -h broker.hivemq.com -t "rastreadores/0407250001/status"

# Testar comando de status
mosquitto_pub -h broker.hivemq.com -t "rastreadores/0407250001/comando" -m "status"

# Verificar dados de localização
mosquitto_sub -h broker.hivemq.com -t "rastreadores/0407250001/localizacao"
```

## 🚨 Solução de Problemas

### Problemas Comuns

#### 1. Firmware não conecta ao MQTT
- ✅ Verificar conexão GSM/GPRS
- ✅ Verificar credenciais do broker
- ✅ Verificar rede móvel

#### 2. App não recebe dados
- ✅ Verificar conexão MQTT
- ✅ Verificar tópicos inscritos
- ✅ Verificar logs do console

#### 3. Dados não salvos no Firebase
- ✅ Verificar autenticação
- ✅ Verificar regras de segurança
- ✅ Verificar estrutura da coleção

### Logs de Debug
```cpp
// Firmware (testeBloqueio.ino)
SerialMon.println("DEBUG: Tentando conectar MQTT...");
SerialMon.println("DEBUG: Tópico inscrito: " + mqtt_command_topic);
SerialMon.println("DEBUG: Sistema de comandos pendentes ativado");
SerialMon.println("DEBUG: Tópicos MQTT configurados corretamente");
```

// App
console.log('DEBUG: MQTT conectado:', isConnected);
console.log('DEBUG: Dados recebidos:', data);
```

## 📈 Otimizações Implementadas

### 1. Processamento em Lote
- Cache de dados de localização
- Processamento a cada 5 segundos
- Tamanho de lote configurável (50 registros)

### 2. Reconexão Inteligente
- Tentativas limitadas (10x)
- Delay progressivo
- Recuperação automática

### 3. Fila de Mensagens
- Mensagens enfileiradas offline
- Processamento automático ao reconectar
- Priorização de comandos críticos

### 4. Cache de Dados
- Dados de localização em memória
- Sincronização periódica
- Redução de operações Firebase

## 🔒 Segurança

### 1. Autenticação
- Firebase Auth para usuários
- Tokens de acesso seguros
- Regras de segurança configuráveis

### 2. Dados Sensíveis
- IDs únicos por dispositivo
- Tópicos MQTT isolados
- Logs sem informações pessoais

### 3. Validação
- Verificação de formato JSON
- Validação de coordenadas GPS
- Sanitização de comandos

## 📱 Interface do Usuário

### 1. Tela de Localização
- Mapa em tempo real
- Status MQTT visível
- Indicadores de conectividade
- **Rastreadores**: Mesmos dispositivos cadastrados no Firebase

### 2. Histórico
- Filtros por período
- Estatísticas detalhadas
- Exportação de dados
- **Rastreadores**: Mesmos dispositivos cadastrados no Firebase

### 3. Monitoramento
- Status dos rastreadores
- Métricas de performance
- Alertas em tempo real
- **Rastreadores**: Mesmos dispositivos cadastrados no Firebase

### 4. Consistência de Dados
- ✅ **Fonte única**: Coleção `users/{userId}/rastradores` do Firebase
- ✅ **Sincronização**: Dados atualizados em tempo real via MQTT
- ✅ **Interface unificada**: Mesmos dispositivos em todas as telas
- ✅ **Histórico integrado**: Baseado nos rastreadores cadastrados

## 🚀 Próximos Passos

### 1. Melhorias Planejadas
- [ ] Criptografia end-to-end
- [ ] Compressão de dados
- [ ] Backup automático
- [ ] Notificações push

### 2. Escalabilidade
- [ ] Múltiplos brokers
- [ ] Load balancing
- [ ] Cache distribuído
- [ ] Monitoramento avançado

### 3. Integrações
- [ ] APIs externas
- [ ] Sistemas de terceiros
- [ ] Webhooks
- [ ] Analytics

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs de debug
2. Consultar documentação
3. Verificar configurações
4. Contatar equipe de desenvolvimento

---

**Versão:** 1.0.0  
**Data:** Dezembro 2024  
**Status:** ✅ Funcionando e Testado
