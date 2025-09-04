# Sistema de Comandos Pendentes para Dispositivo de Rastreamento/Bloqueio

## Visão Geral

Este sistema permite enviar comandos de bloqueio/desbloqueio para dispositivos médicos mesmo quando eles estão offline, garantindo que os comandos sejam executados assim que o dispositivo se reconectar à rede.

## Como Funciona

### 1. Arquitetura do Sistema

```
[App React Native] → [Broker MQTT] → [Dispositivo ESP32]
       ↓                    ↓              ↓
   Envia comando    Armazena comando   Executa comando
   (ON/OFF)         pendente           ao reconectar
```

### 2. Fluxo de Funcionamento

1. **Dispositivo Online**: Comandos são executados imediatamente
2. **Dispositivo Offline**: Comandos são armazenados como "pendentes"
3. **Dispositivo Reconecta**: Verifica comandos pendentes e executa automaticamente
4. **Confirmação**: Status de execução é reportado de volta

## Implementação no Firmware ESP32

### Novos Tópicos MQTT

- `rastreador/comandos_pendentes/0407250001` - Para comandos pendentes
- `rastreador/execucao/0407250001` - Para status de execução

### Funcionalidades Implementadas

1. **Verificação Automática**: Ao reconectar, verifica comandos pendentes
2. **Execução Inteligente**: Evita executar o mesmo comando múltiplas vezes
3. **Status de Execução**: Reporta resultado de cada comando executado
4. **Persistência**: Mantém estado do relé mesmo após reinicialização

## Implementação no Servidor/Aplicativo

### 1. Estrutura de Comando Pendente

```json
{
  "command": "ON",
  "timestamp": "1703123456789",
  "id": "cmd_12345",
  "device_id": "0407250001"
}
```

### 2. Sistema de Armazenamento de Comandos

```javascript
// Exemplo em Node.js
class PendingCommandManager {
  constructor() {
    this.pendingCommands = new Map();
  }

  // Adiciona comando pendente
  addPendingCommand(deviceId, command) {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingCommand = {
      command: command, // "ON" ou "OFF"
      timestamp: Date.now().toString(),
      id: commandId,
      device_id: deviceId,
      status: "pending"
    };

    this.pendingCommands.set(commandId, pendingCommand);
    
    // Publica no tópico de comandos pendentes
    this.publishPendingCommand(deviceId, pendingCommand);
    
    return commandId;
  }

  // Processa solicitação de comandos pendentes
  handlePendingRequest(deviceId, requestMessage) {
    const deviceCommands = Array.from(this.pendingCommands.values())
      .filter(cmd => cmd.device_id === deviceId && cmd.status === "pending");
    
    if (deviceCommands.length > 0) {
      // Envia comando pendente mais antigo
      const oldestCommand = deviceCommands.reduce((oldest, current) => 
        parseInt(current.timestamp) < parseInt(oldest.timestamp) ? current : oldest
      );
      
      return oldestCommand;
    }
    
    return null;
  }

  // Marca comando como processado
  markCommandAsProcessed(commandId) {
    const command = this.pendingCommands.get(commandId);
    if (command) {
      command.status = "processed";
      command.processed_at = Date.now().toString();
    }
  }
}
```

### 3. Integração com Broker MQTT

```javascript
// Configuração do broker MQTT
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.hivemq.com');

const pendingManager = new PendingCommandManager();

// Assina tópicos
client.subscribe('rastreador/comandos/0407250001');
client.subscribe('rastreador/comandos_pendentes/0407250001');
client.subscribe('rastreador/execucao/0407250001');

// Processa mensagens recebidas
client.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  
  if (topic === 'rastreador/comandos/0407250001') {
    // Comando direto - tenta enviar imediatamente
    client.publish('rastreador/comandos/0407250001', data.command);
  }
  
  if (topic === 'rastreador/comandos_pendentes/0407250001') {
    if (data.action === 'request_pending') {
      // Dispositivo solicitando comandos pendentes
      const pendingCommand = pendingManager.handlePendingRequest(data.device_id, data);
      
      if (pendingCommand) {
        client.publish('rastreador/comandos_pendentes/0407250001', JSON.stringify(pendingCommand));
      }
    } else if (data.status === 'processed') {
      // Comando foi processado pelo dispositivo
      pendingManager.markCommandAsProcessed(data.command_id);
    }
  }
  
  if (topic === 'rastreador/execucao/0407250001') {
    // Status de execução do comando
    console.log('Status de execução:', data);
  }
});
```

## Implementação no App React Native

### 1. Envio de Comandos

```typescript
// Envia comando direto (dispositivo online)
const sendDirectCommand = async (command: 'ON' | 'OFF') => {
  try {
    await mqttClient.publish('rastreador/comandos/0407250001', command);
    console.log('Comando enviado diretamente');
  } catch (error) {
    console.log('Falha ao enviar comando direto, enviando como pendente');
    await sendPendingCommand(command);
  }
};

// Envia comando pendente (dispositivo offline)
const sendPendingCommand = async (command: 'ON' | 'OFF') => {
  try {
    const pendingCommand = {
      command: command,
      timestamp: Date.now().toString(),
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      device_id: '0407250001'
    };
    
    await mqttClient.publish('rastreador/comandos_pendentes/0407250001', JSON.stringify(pendingCommand));
    console.log('Comando enviado como pendente');
    
    // Salva localmente para acompanhamento
    await AsyncStorage.setItem('pendingCommand', JSON.stringify(pendingCommand));
  } catch (error) {
    console.error('Erro ao enviar comando pendente:', error);
  }
};
```

### 2. Monitoramento de Status

```typescript
// Monitora status de execução
useEffect(() => {
  const subscription = mqttClient.subscribe('rastreador/execucao/0407250001');
  
  subscription.on('message', (topic, message) => {
    const status = JSON.parse(message.toString());
    
    if (status.status === 'executado') {
      console.log(`Comando ${status.comando} executado com sucesso`);
      // Remove comando pendente do armazenamento local
      AsyncStorage.removeItem('pendingCommand');
      
      // Atualiza UI
      setDeviceStatus(status.resultado);
    } else if (status.status === 'erro') {
      console.log(`Erro ao executar comando: ${status.resultado}`);
    }
  });
  
  return () => subscription.unsubscribe();
}, []);
```

## Vantagens do Sistema

1. **Confiabilidade**: Comandos não são perdidos quando dispositivo está offline
2. **Eficiência**: Execução automática sem intervenção manual
3. **Rastreabilidade**: Status completo de cada comando
4. **Escalabilidade**: Funciona com múltiplos dispositivos
5. **Robustez**: Sistema de retry automático

## Considerações de Segurança

1. **Autenticação MQTT**: Implementar usuário/senha para o broker
2. **Criptografia**: Usar MQTT over TLS (porta 8883)
3. **Validação**: Verificar origem dos comandos
4. **Rate Limiting**: Limitar frequência de comandos

## Testes Recomendados

1. **Teste de Conectividade**: Enviar comando com dispositivo online
2. **Teste de Desconexão**: Enviar comando com dispositivo offline
3. **Teste de Reconexão**: Verificar execução automática ao reconectar
4. **Teste de Múltiplos Comandos**: Verificar ordem de execução
5. **Teste de Falha**: Simular falhas de rede e verificar recuperação

## Próximos Passos

1. Implementar sistema de comandos pendentes no servidor
2. Atualizar app React Native para suportar comandos pendentes
3. Configurar broker MQTT com autenticação
4. Implementar sistema de notificações para status de execução
5. Adicionar logs e monitoramento para debugging

