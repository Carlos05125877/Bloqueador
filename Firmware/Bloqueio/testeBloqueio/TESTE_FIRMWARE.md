# Teste do Firmware testeBloqueio.ino

## 🧪 Testes de Funcionalidade

### 1. Teste de Conexão MQTT
```bash
# Monitorar serial
cd Firmware/Bloqueio/testeBloqueio
pio device monitor

# Verificar logs esperados:
✅ "Iniciando TTGO T-Call com Controle de Relé/LED via MQTT e GPS..."
✅ "Sistema de Comandos Pendentes Ativado!"
✅ "MQTT conectado com sucesso"
✅ "Inscrito aos tópicos: rastreadores/0407250001/comando e comandos_pendentes"
✅ "Tópicos MQTT configurados corretamente"
```

### 2. Teste de Comandos Diretos
```bash
# Comando de bloqueio
mosquitto_pub -h broker.hivemq.com -t "rastreadores/0407250001/comando" -m "bloqueio"

# Comando de desbloqueio
mosquitto_pub -h broker.hivemq.com -t "rastreadores/0407250001/comando" -m "desbloqueio"

# Comando de status
mosquitto_pub -h broker.hivemq.com -t "rastreadores/0407250001/comando" -m "status"
```

### 3. Verificação de Respostas
```bash
# Monitorar tópico de status
mosquitto_sub -h broker.hivemq.com -t "rastreadores/0407250001/status"

# Respostas esperadas:
# Para bloqueio: {"status":"online","relay":"ON","comando":"bloqueio","resultado":"executado","timestamp":1234567890}
# Para desbloqueio: {"status":"online","relay":"OFF","comando":"desbloqueio","resultado":"executado","timestamp":1234567890}
# Para status: {"status":"online","relay":"ON/OFF","bateria":85,"timestamp":1234567890}
```

### 4. Teste de Dados GPS
```bash
# Monitorar tópico de localização
mosquitto_sub -h broker.hivemq.com -t "rastreadores/0407250001/localizacao"

# Dados esperados (a cada 90 segundos):
# {"latitude":-19.479220,"longitude":-44.247699,"timestamp":1234567890,"velocidade":0.0,"bateria":85,"sinal":75,"status":"online"}
```

### 5. Teste de Comandos Pendentes
```bash
# O firmware automaticamente solicita comandos pendentes a cada 10 segundos após reconexão
# Verificar no serial: "Solicitando verificação de comandos pendentes..."

# Enviar comando pendente
mosquitto_pub -h broker.hivemq.com -t "rastreadores/0407250001/comandos_pendentes" -m '{"command":"bloqueio","timestamp":"1234567890","id":"cmd_001"}'
```

## 🔍 Verificações de Hardware

### 1. LED de Status MQTT (Pino 13)
- ✅ **LIGADO**: GPRS e MQTT conectados
- ❌ **DESLIGADO**: GPRS ou MQTT desconectados

### 2. Relé de Bloqueio (Pino 2)
- ✅ **HIGH**: Veículo bloqueado
- ❌ **LOW**: Veículo desbloqueado

### 3. Indicadores Visuais
- **LED MQTT**: Status da conexão
- **Relé**: Estado de bloqueio/desbloqueio

## 📊 Métricas de Performance

### 1. Tempos de Resposta
- **Comando → Execução**: < 100ms
- **GPS → Publicação**: 90 segundos (configurável)
- **Bateria → Verificação**: 60 segundos
- **Comandos Pendentes**: 10 segundos

### 2. Consumo de Energia
- **Modo Ativo**: ~200mA
- **Modo GPS**: +50mA
- **Modo MQTT**: +30mA
- **Modo Standby**: ~50mA

## 🚨 Tratamento de Erros

### 1. Reconexão Automática
- **GPRS**: Tentativas ilimitadas a cada 5 segundos
- **MQTT**: Tentativas ilimitadas a cada 5 segundos
- **GPS**: Continua funcionando offline

### 2. Logs de Erro
```cpp
// Erros comuns e soluções:
❌ "Falha ao reiniciar o modem" → Verificar energia e conexões
❌ "GPRS desconectado" → Verificar APN e rede móvel
❌ "MQTT desconectado" → Verificar broker e credenciais
❌ "Localização GPS não válida" → Aguardar correção de satélites
```

## 🔧 Configurações Avançadas

### 1. Parâmetros Ajustáveis
```cpp
const long gpsPublishInterval = 90000;      // Intervalo GPS (ms)
const long batteryCheckInterval = 60000;    // Verificação bateria (ms)
const long pendingCommandCheckInterval = 10000; // Comandos pendentes (ms)
const int BATTERY_LOW_THRESHOLD = 20;      // Limite bateria baixa (%)
```

### 2. Personalização
- **ID do Dispositivo**: Alterar `mqtt_client_id`
- **APN**: Configurar para sua operadora
- **Broker MQTT**: Alterar `mqtt_broker` e `mqtt_port`
- **Tópicos**: Modificar estrutura de tópicos se necessário

## 📱 Integração com App

### 1. Compatibilidade
- ✅ **Tópicos MQTT**: Formato `rastreadores/{ID}/...`
- ✅ **Formato JSON**: Estrutura padronizada
- ✅ **Comandos**: `bloqueio`, `desbloqueio`, `status`
- ✅ **Dados GPS**: Latitude, longitude, velocidade, bateria, sinal

### 2. Consistência de Dados
- ✅ **Rastreadores**: Mesmos dispositivos em todas as telas (Localização, Bloqueio, Histórico)
- ✅ **Fonte única**: Coleção `users/{userId}/rastradores` do Firebase
- ✅ **Sincronização**: Dados atualizados em tempo real via MQTT
- ✅ **Histórico**: Baseado nos mesmos rastreadores cadastrados

### 2. Fluxo de Dados
```
App → MQTT → Firmware → Relé
GPS → Firmware → MQTT → App → Firebase
```

## 🎯 Próximos Testes

### 1. Testes de Estresse
- [ ] Múltiplos comandos simultâneos
- [ ] Perda de conexão prolongada
- [ ] Bateria baixa
- [ ] Sinal GSM fraco

### 2. Testes de Integração
- [ ] App React Native
- [ ] Firebase Firestore
- [ ] Sistema de histórico
- [ ] Estatísticas em tempo real

---

**Status do Teste**: ✅ Funcionando  
**Última Atualização**: Dezembro 2024  
**Firmware**: testeBloqueio.ino v2.0
