# Consistência de Dados - Sistema de Rastreadores

## 📋 Visão Geral

Este documento explica como o sistema mantém a consistência dos dados de rastreadores entre todas as telas do aplicativo, garantindo que os mesmos dispositivos sejam exibidos em Localização, Bloqueio, Histórico e outras funcionalidades.

## 🔄 Arquitetura de Dados

### 1. Fonte Única de Verdade
```
Firebase Firestore
└── users/{userId}/rastradores/{rastreadorId}
    ├── numeroRastreador: string
    ├── equipamentoVinculado: object
    │   ├── modeloEquipamento: string
    │   ├── numeroSerie: string
    │   ├── dataInstalacao: string
    │   └── tecnico: string
    ├── ultimaLatitude: number
    ├── ultimaLongitude: number
    ├── ultimaAtualizacao: timestamp
    └── historico: subcollection
        └── {localizacaoId}
            ├── latitude: number
            ├── longitude: number
            ├── timestamp: timestamp
            ├── velocidade: number
            ├── bateria: number
            └── sinal: number
```

### 2. Fluxo de Sincronização
```
Firmware ESP32 → MQTT → App React Native → Firebase Firestore
                ↓
        Todas as Telas (Localização, Bloqueio, Histórico)
```

## 📱 Telas e Funcionalidades

### 1. Tela de Localização (`LocalizacaoScreen`)
- **Fonte**: `users/{userId}/rastradores`
- **Função**: Selecionar rastreador e exibir mapa
- **Dados**: Lista de rastreadores cadastrados
- **Atualização**: Tempo real via MQTT

### 2. Tela de Bloqueio (`BloqueioScreen`)
- **Fonte**: `users/{userId}/rastradores`
- **Função**: Controle de bloqueio/desbloqueio
- **Dados**: Mesmos rastreadores da tela de localização
- **Atualização**: Comandos enviados via MQTT

### 3. Tela de Histórico (`HistoricoScreen`)
- **Fonte**: `users/{userId}/rastradores/{rastreadorId}/historico`
- **Função**: Visualizar histórico de localizações
- **Dados**: Histórico baseado no rastreador selecionado
- **Atualização**: Dados salvos automaticamente via MQTT

### 4. Tela de Lista (`ListaScreen`)
- **Fonte**: `users/{userId}/rastradores`
- **Função**: Listar todos os rastreadores
- **Dados**: Lista completa de rastreadores
- **Atualização**: Dados do Firestore

## 🔧 Implementação Técnica

### 1. Carregamento de Rastreadores
```typescript
// Todas as telas usam a mesma função de carregamento
const carregarRastreadores = async () => {
  const rastreadoresRef = collection(db, 'users', userId, 'rastradores');
  const snapshot = await getDocs(rastreadoresRef);
  
  const lista: Rastreador[] = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    return {
      id: doc.id,
      numeroRastreador: data.numeroRastreador || doc.id,
      equipamentoVinculado: data.equipamentoVinculado,
      ...data
    };
  });
  
  setRastreadores(lista);
};
```

### 2. Seleção de Rastreador
```typescript
// Componente SelectRastrador usado em múltiplas telas
<SelectRastrador
  selected={selectedRastreador}
  onSelect={handleRastreadorSelect}
/>
```

### 3. Integração MQTT
```typescript
// Hook useMQTT usado em todas as telas que precisam de dados em tempo real
const { isConnected, stats, sendCommand } = useMQTT();
```

## ✅ Benefícios da Consistência

### 1. Experiência do Usuário
- **Interface unificada**: Mesmos dispositivos em todas as telas
- **Navegação intuitiva**: Seleção de rastreador consistente
- **Dados atualizados**: Informações sincronizadas em tempo real

### 2. Manutenibilidade
- **Código reutilizável**: Funções de carregamento compartilhadas
- **Bug fixes centralizados**: Correções aplicadas a todas as telas
- **Testes simplificados**: Mesma lógica de dados para testar

### 3. Performance
- **Cache compartilhado**: Dados carregados uma vez, usado em múltiplas telas
- **Sincronização eficiente**: Atualizações MQTT aplicadas globalmente
- **Redução de requisições**: Menos chamadas ao Firebase

## 🚨 Tratamento de Erros

### 1. Falha na Conexão Firebase
```typescript
try {
  const snapshot = await getDocs(rastreadoresRef);
  // Processar dados
} catch (error) {
  setErro('Erro ao carregar rastreadores.');
  console.error('Erro ao carregar rastreadores:', error);
}
```

### 2. Falha na Conexão MQTT
```typescript
const { isConnected, stats } = useMQTT();

// Mostrar status de conexão na interface
{!isConnected && (
  <Text style={styles.erroTexto}>
    Desconectado do MQTT. Dados podem estar desatualizados.
  </Text>
)}
```

### 3. Dados Inconsistentes
```typescript
// Validação de dados antes de usar
if (rastreador && rastreador.numeroRastreador) {
  // Usar dados do rastreador
} else {
  // Mostrar erro ou dados padrão
}
```

## 🔄 Atualizações em Tempo Real

### 1. Via MQTT
- **Localização**: Atualizada automaticamente quando recebida do firmware
- **Status**: Atualizado quando comandos são executados
- **Bateria/Sinal**: Atualizado quando valores mudam significativamente

### 2. Via Firebase
- **Cadastro**: Novos rastreadores aparecem automaticamente
- **Edição**: Mudanças refletidas em todas as telas
- **Exclusão**: Rastreadores removidos não aparecem mais

### 3. Via Interface
- **Refresh**: Botão de atualização manual disponível
- **Pull-to-refresh**: Gestos de atualização em listas
- **Auto-refresh**: Atualização automática em intervalos

## 📊 Monitoramento e Logs

### 1. Logs de Consistência
```typescript
console.log('Rastreadores carregados:', lista);
console.log('Rastreador selecionado:', rastreadorSelecionado);
console.log('Dados MQTT recebidos:', data);
```

### 2. Métricas de Performance
- **Tempo de carregamento**: Medido em todas as telas
- **Taxa de sucesso**: Requisições Firebase bem-sucedidas
- **Latência MQTT**: Tempo de resposta dos comandos

### 3. Alertas de Inconsistência
- **Dados desatualizados**: Alertas quando dados estão muito antigos
- **Falha de sincronização**: Notificações de problemas de conexão
- **Conflitos de dados**: Alertas quando dados não fazem sentido

## 🎯 Próximas Melhorias

### 1. Cache Inteligente
- [ ] Cache local dos dados de rastreadores
- [ ] Sincronização offline com sincronização automática
- [ ] Priorização de dados críticos

### 2. Validação Avançada
- [ ] Verificação de integridade dos dados
- [ ] Validação de formato antes de salvar
- [ ] Alertas de dados corrompidos

### 3. Backup e Recuperação
- [ ] Backup automático dos dados críticos
- [ ] Recuperação de dados perdidos
- [ ] Histórico de mudanças

---

**Status**: ✅ Implementado e Funcionando  
**Última Atualização**: Dezembro 2024  
**Versão**: 1.0.0

