# Histórico de Localização - Documentação

## Visão Geral

A tela de Histórico de Localização permite visualizar o histórico completo de localizações de cada dispositivo rastreador, incluindo coordenadas GPS, timestamps, endereços e métricas adicionais como velocidade, bateria e sinal.

## Funcionalidades

### 1. Seletor de Rastreador
- Lista todos os rastreadores cadastrados do usuário
- Exibe modelo do equipamento e número de série
- Seleção automática do primeiro rastreador disponível

### 2. Filtros de Data
- Filtro por período específico (data início e fim)
- Formato de data: DD/MM/AAAA
- Botão para aplicar filtros e limpar filtros

### 3. Estatísticas
- Total de registros encontrados
- Data do primeiro registro
- Data do último registro

### 4. Lista de Histórico
- Ordenação por timestamp (mais recente primeiro)
- Limite de 100 registros por consulta
- Exibição de coordenadas GPS formatadas
- Informações adicionais quando disponíveis

## Estrutura de Dados no Firebase

### Coleção: `users/{userId}/rastradores/{rastreadorId}/historico`

Cada documento na subcoleção `historico` deve conter:

```json
{
  "id": "auto-generated",
  "numeroRastreador": "RAST001",
  "latitude": -23.550520,
  "longitude": -46.633308,
  "timestamp": "2024-01-15T10:30:00Z",
  "endereco": "Av. Paulista, 1000, São Paulo - SP",
  "velocidade": 45.5,
  "bateria": 85,
  "sinal": 92
}
```

### Campos Obrigatórios:
- `latitude`: Coordenada de latitude (número)
- `longitude`: Coordenada de longitude (número)
- `timestamp`: Data e hora da localização (Firestore Timestamp)

### Campos Opcionais:
- `endereco`: Endereço formatado (string)
- `velocidade`: Velocidade em km/h (número)
- `bateria`: Nível da bateria em % (número)
- `sinal`: Qualidade do sinal em % (número)

## Como Implementar no Backend

### 1. Salvar Localização
```javascript
// Exemplo de como salvar uma nova localização
const salvarLocalizacao = async (userId, rastreadorId, dadosLocalizacao) => {
  const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
  
  const novaLocalizacao = {
    numeroRastreador: rastreadorId,
    latitude: dadosLocalizacao.latitude,
    longitude: dadosLocalizacao.longitude,
    timestamp: new Date(),
    endereco: dadosLocalizacao.endereco,
    velocidade: dadosLocalizacao.velocidade,
    bateria: dadosLocalizacao.bateria,
    sinal: dadosLocalizacao.sinal
  };
  
  await addDoc(historicoRef, novaLocalizacao);
};
```

### 2. Consultar Histórico
```javascript
// Exemplo de como consultar o histórico
const consultarHistorico = async (userId, rastreadorId, dataInicio, dataFim) => {
  const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
  
  let q = query(historicoRef, orderBy('timestamp', 'desc'), limit(100));
  
  if (dataInicio && dataFim) {
    const inicio = new Date(dataInicio + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');
    q = query(
      historicoRef,
      where('timestamp', '>=', inicio),
      where('timestamp', '<=', fim),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

## Índices Necessários no Firestore

Para otimizar as consultas, crie os seguintes índices compostos:

1. **Índice para consulta com filtro de data:**
   - Collection: `users/{userId}/rastradores/{rastreadorId}/historico`
   - Fields: `timestamp` (Ascending), `timestamp` (Descending)

2. **Índice para ordenação por timestamp:**
   - Collection: `users/{userId}/rastradores/{rastreadorId}/historico`
   - Fields: `timestamp` (Descending)

## Funcionalidades Futuras

### 1. Integração com Mapas
- Abertura direta no Google Maps/Apple Maps
- Visualização em mapa embutido
- Rota entre pontos de localização

### 2. Exportação de Dados
- Exportar histórico para CSV/PDF
- Compartilhamento de relatórios
- Backup automático de dados

### 3. Análise Avançada
- Gráficos de movimento
- Relatórios de tempo em localização
- Alertas de comportamento suspeito

### 4. Filtros Adicionais
- Filtro por velocidade
- Filtro por nível de bateria
- Filtro por qualidade de sinal
- Busca por endereço

## Considerações de Performance

1. **Limite de Registros**: Máximo de 100 registros por consulta para evitar sobrecarga
2. **Índices**: Criar índices compostos para consultas eficientes
3. **Paginação**: Implementar paginação para históricos muito longos
4. **Cache**: Considerar cache local para consultas frequentes

## Segurança

1. **Regras do Firestore**: Configurar regras para permitir acesso apenas aos dados do usuário autenticado
2. **Validação**: Validar coordenadas GPS antes de salvar
3. **Rate Limiting**: Implementar limites de taxa para evitar spam de localizações

## Exemplo de Regras do Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/rastradores/{rastreadorId}/historico/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting

### Problema: Histórico não carrega
- Verificar se o usuário está autenticado
- Verificar se o rastreador existe
- Verificar se há dados na subcoleção `historico`

### Problema: Filtros não funcionam
- Verificar formato da data (DD/MM/AAAA)
- Verificar se as datas são válidas
- Verificar se há índices criados no Firestore

### Problema: Performance lenta
- Verificar se os índices estão criados
- Reduzir o limite de registros
- Implementar paginação

