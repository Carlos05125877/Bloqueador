# Sistema de Comandos Pendentes - Implementação Back-End (Sistema de Confirmação)

## Visão Geral

Este sistema permite enviar comandos de bloqueio/desbloqueio para dispositivos médicos mesmo quando eles estão offline, **sem alterar a interface do usuário**. A funcionalidade é implementada apenas no back-end, mantendo o design original da aplicação.

## 🔄 **Nova Lógica de Funcionamento com Confirmação**

### **Como Funciona Agora:**
1. **App SEMPRE** envia comando diretamente para o ESP32
2. **App aguarda confirmação** do ESP32 (timeout de 5 segundos)
3. **Se receber confirmação**: Comando executado com sucesso
4. **Se não receber confirmação**: Comando enviado como pendente
5. **Comandos pendentes** são executados mesmo se o app estiver offline

## 🎯 **Fluxo de Funcionamento Detalhado**

### **Cenário 1: ESP32 Online e Responde**
```
[Usuário clica] → [App envia comando direto] → [ESP32 executa] → [ESP32 confirma] → [App recebe confirmação] → [Status atualizado]
```

### **Cenário 2: ESP32 Offline (Não Responde)**
```
[Usuário clica] → [App envia comando direto] → [Timeout 5s] → [App envia como pendente] → [ESP32 executa quando conectar]
```

### **Cenário 3: ESP32 Online mas Falha na Execução**
```
[Usuário clica] → [App envia comando direto] → [ESP32 falha] → [Timeout 5s] → [App envia como pendente]
```

## 🔧 **Implementação Técnica**

### **1. App React Native (Sistema de Confirmação)**

**Função `publishCommand`:**
```typescript
const publishCommand = (command: string) => {
  // SEMPRE envia o comando diretamente para o ESP32
  if (client && client.connected) {
    // Envia comando direto e aguarda confirmação
    sendDirectCommandWithConfirmation(command);
  } else {
    // Cliente MQTT não disponível - enviando como pendente
    sendAsPendingCommand(command);
  }
};
```

**Função `sendDirectCommandWithConfirmation`:**
```typescript
const sendDirectCommandWithConfirmation = (command: string) => {
  // Gera ID único para este comando
  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Envia comando com ID para rastreamento
  const commandWithId = JSON.stringify({
    command: command,
    id: commandId,
    timestamp: Date.now().toString(),
    device_id: selectedRastreador
  });
  
  client.publish(MQTT_COMMAND_TOPIC, commandWithId, (err) => {
    if (err) {
      sendAsPendingCommand(command);
      return;
    }
    
    // Configura timeout para confirmação (5 segundos)
    const confirmationTimeout = setTimeout(() => {
      console.log('⏰ Timeout: ESP32 não confirmou execução');
      sendAsPendingCommand(command);
    }, 5000);
    
    // Listener temporário para confirmação
    const confirmationListener = (topic: string, message: Buffer) => {
      try {
        const response = JSON.parse(message.toString());
        
        // Verifica se é a confirmação do comando enviado
        if (response.command_id === commandId && response.status === 'executed') {
          console.log('✅ Confirmação recebida do ESP32!');
          clearTimeout(confirmationTimeout);
          
          // Atualiza estado
          setLedState(command === 'ON' ? 'Bloqueado' : 'Desbloqueado');
          Alert.alert('Comando Executado', `Comando "${command}" executado com sucesso pelo ESP32!`);
        }
      } catch (error) {
        console.log('⚠️ Mensagem recebida não é confirmação válida');
      }
    };
    
    // Adiciona listener para confirmação
    client.on('message', confirmationListener);
  });
};
```

### **2. Firmware ESP32 (Sistema de Confirmação)**

**Função `executeCommand` Modificada:**
```cpp
void executeCommand(String command) {
  // Tenta extrair ID do comando se for JSON
  String commandId = "";
  if (command.startsWith("{")) {
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, command);
    if (!error && doc.containsKey("id")) {
      commandId = doc["id"].as<String>();
      command = doc["command"].as<String>(); // Extrai o comando real
    }
  }
  
  if (command == "ON") {
    digitalWrite(OUT_PIN, HIGH);
    // ... execução do comando ...
    
    // Envia confirmação com ID se disponível
    if (commandId != "") {
      String confirmationMessage = "{\"status\":\"executed\",\"command_id\":\"" + commandId + "\",\"device_id\":\"" + String(mqtt_client_id) + "\",\"timestamp\":\"" + String(millis()) + "\"}";
      mqttClient.publish(mqtt_execution_status_topic, confirmationMessage.c_str());
    }
  }
  // ... similar para OFF ...
}
```

## 📊 **Estados e Comportamentos**

| Situação | Ação do App | Ação do ESP32 | Resultado |
|----------|-------------|---------------|-----------|
| **ESP32 Online + Responde** | Envia direto + aguarda confirmação | Executa + confirma | ✅ Execução instantânea confirmada |
| **ESP32 Online + Não Responde** | Timeout 5s → envia como pendente | - | ⏳ Comando pendente |
| **ESP32 Offline** | Timeout 5s → envia como pendente | - | ⏳ Comando pendente |
| **App Offline** | - | Busca comandos pendentes | 🔄 Execução automática |

## 🎨 **Interface do Usuário (Inalterada)**

- ✅ Design original mantido
- ✅ Botões sempre habilitados
- ✅ Usuário não vê diferença visual
- ✅ Experiência transparente

## 🚀 **Vantagens da Nova Implementação**

1. **Confiabilidade Máxima**
   - Comandos nunca são perdidos
   - Confirmação em tempo real
   - Fallback automático para pendentes

2. **Inteligência**
   - ESP32 gerencia seu próprio estado
   - App detecta falhas automaticamente
   - Sistema robusto e automático

3. **Transparência**
   - Usuário sempre recebe feedback
   - Interface idêntica
   - Funcionamento automático

## 🧪 **Como Testar**

### **1. Teste ESP32 Online e Responsivo:**
- ESP32 ligado e conectado
- Clique em botão
- Esperado: "Comando executado com sucesso pelo ESP32!" em <5s

### **2. Teste ESP32 Online mas Não Responsivo:**
- ESP32 ligado mas não responde
- Clique em botão
- Esperado: "Comando enviado como pendente" após 5s

### **3. Teste ESP32 Offline:**
- ESP32 desligado
- Clique em botão
- Esperado: "Comando enviado como pendente" após 5s

### **4. Teste Reconexão:**
- ESP32 offline → envie comando pendente
- ESP32 ligue e conecte
- Esperado: Comando executado automaticamente

## 📝 **Arquivos Modificados**

### **1. `app/Screens/BloqueioScreen.tsx`**
- ✅ Sistema de confirmação implementado
- ✅ Timeout de 5 segundos
- ✅ Fallback automático para pendentes
- ✅ Design original mantido

### **2. `Firmware/Bloqueio/testeBloqueio.ino`**
- ✅ Sistema de confirmação implementado
- ✅ Extração de ID de comandos JSON
- ✅ Envio de confirmações com ID
- ✅ Verificação automática de comandos pendentes

## 🎯 **Resultado Final**

- 🎨 **Interface**: Exatamente igual à original
- 🔧 **Funcionalidade**: Sistema de confirmação + comandos pendentes
- 📱 **Experiência**: Usuário sempre recebe feedback preciso
- 🚀 **Confiabilidade**: Sistema robusto com confirmação em tempo real
- 🎯 **Lógica**: Baseada na resposta real do ESP32, não em suposições

O sistema agora funciona de forma inteligente e confiável:
1. **SEMPRE** tenta execução direta
2. **AGUARDA** confirmação do ESP32
3. **FALLBACK** automático para pendentes se necessário
4. **EXECUÇÃO** automática quando ESP32 reconecta

**Comandos nunca são perdidos e o usuário sempre sabe o que aconteceu!**
