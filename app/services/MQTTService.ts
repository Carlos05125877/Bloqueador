import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import mqtt, { IClientOptions, MqttClient } from 'mqtt';
import { db } from '../firebase/firebaseConfig';

export interface LocationData {
  rastreadorId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  velocidade?: number;
  bateria?: number;
  sinal?: number;
  endereco?: string;
  status?: 'online' | 'offline' | 'error';
  ultimaComunicacao?: Date;
}

export interface MQTTConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
  keepalive: number;
  reconnectPeriod: number;
  connectTimeout: number;
}

class MQTTService {
  private client: MqttClient | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000; // Delay inicial de 5 segundos
  private maxReconnectDelay: number = 60000; // Delay máximo de 1 minuto
  private isReconnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: Array<{ topic: string; message: string; qos: number }> = [];
  private locationDataCache: Map<string, LocationData> = new Map();
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  private batchSize: number = 50;
  private batchTimeout: number = 5000; // 5 segundos

  // Configuração padrão do MQTT
  private defaultConfig: MQTTConfig = {
    host: 'broker.hivemq.com', // Broker público para testes
    port: 1883,
    clientId: `bloqueador_${Date.now()}`,
    keepalive: 60,
    reconnectPeriod: 0, // Desabilitar reconexão automática do cliente MQTT
    connectTimeout: 30000
  };

  constructor() {
    this.setupBatchProcessing();
  }

  /**
   * Conecta ao broker MQTT
   */
  public async connect(config?: Partial<MQTTConfig>): Promise<boolean> {
    try {
      const mqttConfig: MQTTConfig = { ...this.defaultConfig, ...config };
      
      const options: IClientOptions = {
        host: mqttConfig.host,
        port: mqttConfig.port,
        clientId: mqttConfig.clientId,
        keepalive: mqttConfig.keepalive,
        reconnectPeriod: mqttConfig.reconnectPeriod,
        connectTimeout: mqttConfig.connectTimeout,
        clean: true,
        rejectUnauthorized: false
      };

      if (mqttConfig.username && mqttConfig.password) {
        options.username = mqttConfig.username;
        options.password = mqttConfig.password;
      }

      return new Promise((resolve) => {
        this.client = mqtt.connect(options);

        this.client.on('connect', () => {
          console.log('✅ MQTT conectado com sucesso');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.processMessageQueue();
          this.subscribeToTopics();
          resolve(true);
        });

        this.client.on('message', (topic: string, message: Buffer) => {
          this.handleMessage(topic, message);
        });

        this.client.on('error', (error) => {
          console.error('❌ Erro MQTT:', error);
          this.isConnected = false;
        });

        this.client.on('close', () => {
          console.log('🔌 Conexão MQTT fechada');
          this.isConnected = false;
          
          // Tentar reconectar apenas se não estiver já tentando
          if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        this.client.on('reconnect', () => {
          console.log('🔄 Reconectando MQTT...');
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Máximo de tentativas de reconexão atingido');
            this.client?.end();
            this.isConnected = false;
            // Parar de tentar reconectar após atingir o limite
            return;
          }
          
          // Log do progresso de reconexão
          console.log(`📊 Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        });

        this.client.on('offline', () => {
          console.log('📴 MQTT offline');
          this.isConnected = false;
        });
      });
    } catch (error) {
      console.error('❌ Erro ao conectar MQTT:', error);
      return false;
    }
  }

  /**
   * Agenda uma tentativa de reconexão com backoff exponencial
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    
    // Calcular delay com backoff exponencial
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    
    console.log(`⏰ Agendando reconexão em ${delay/1000} segundos (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      await this.attemptReconnect();
    }, delay);
  }

  /**
   * Tenta reconectar ao broker MQTT
   */
  private async attemptReconnect(): Promise<void> {
    if (this.isReconnecting) {
      this.isReconnecting = false;
      
      try {
        console.log('🔄 Tentando reconectar...');
        const success = await this.connect();
        
        if (success) {
          console.log('✅ Reconexão bem-sucedida!');
          this.reconnectAttempts = 0; // Reset contador
          this.reconnectDelay = 5000; // Reset delay
        } else {
          console.log('❌ Reconexão falhou');
          this.reconnectAttempts++;
          
          // Tentar novamente se ainda não atingiu o limite
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            console.error('🚫 Limite máximo de tentativas de reconexão atingido. Parando.');
          }
        }
      } catch (error) {
        console.error('❌ Erro durante reconexão:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      }
    }
  }

  /**
   * Inscreve nos tópicos necessários
   */
  private subscribeToTopics(): void {
    if (!this.client || !this.isConnected) return;

    const topics = [
      'rastreadores/+/localizacao',
      'rastreadores/+/status',
      'rastreadores/+/comando',
      'sistema/status'
    ];

    topics.forEach(topic => {
      this.client!.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          console.error(`❌ Erro ao se inscrever no tópico ${topic}:`, error);
        } else {
          console.log(`✅ Inscrito no tópico: ${topic}`);
        }
      });
    });
  }

  /**
   * Processa mensagens recebidas
   */
  private async handleMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const messageStr = message.toString();
      const data = JSON.parse(messageStr);

      console.log(`📨 Mensagem recebida no tópico ${topic}:`, data);

      // Extrair ID do rastreador do tópico
      const topicParts = topic.split('/');
      const rastreadorId = topicParts[1];
      const messageType = topicParts[2];

      switch (messageType) {
        case 'localizacao':
          await this.processLocationData(rastreadorId, data);
          break;
        case 'status':
          await this.processStatusData(rastreadorId, data);
          break;
        case 'comando':
          await this.processCommandResponse(rastreadorId, data);
          break;
        default:
          console.log(`📝 Tipo de mensagem não reconhecido: ${messageType}`);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem MQTT:', error);
    }
  }

  /**
   * Processa dados de localização
   */
  private async processLocationData(rastreadorId: string, data: any): Promise<void> {
    try {
      const locationData: LocationData = {
        rastreadorId,
        latitude: parseFloat(data.latitude) || 0,
        longitude: parseFloat(data.longitude) || 0,
        timestamp: new Date(data.timestamp || Date.now()),
        velocidade: data.velocidade ? parseFloat(data.velocidade) : undefined,
        bateria: data.bateria ? parseInt(data.bateria) : undefined,
        sinal: data.sinal ? parseInt(data.sinal) : undefined,
        endereco: data.endereco,
        status: 'online',
        ultimaComunicacao: new Date()
      };

      // Adicionar ao cache para processamento em lote
      this.locationDataCache.set(rastreadorId, locationData);

      // Processar em lote se atingir o tamanho limite
      if (this.locationDataCache.size >= this.batchSize) {
        this.processBatchUpdate();
      }

      // Atualizar status do rastreador
      await this.updateRastreadorStatus(rastreadorId, {
        status: 'online',
        ultimaComunicacao: new Date(),
        ultimaLocalizacao: locationData
      });

    } catch (error) {
      console.error('❌ Erro ao processar dados de localização:', error);
    }
  }

  /**
   * Processa dados de status
   */
  private async processStatusData(rastreadorId: string, data: any): Promise<void> {
    try {
      await this.updateRastreadorStatus(rastreadorId, {
        status: data.status || 'online',
        bateria: data.bateria,
        sinal: data.sinal,
        ultimaComunicacao: new Date(),
        ultimaAtualizacao: new Date()
      });
    } catch (error) {
      console.error('❌ Erro ao processar dados de status:', error);
    }
  }

  /**
   * Processa resposta de comando
   */
  private async processCommandResponse(rastreadorId: string, data: any): Promise<void> {
    try {
      console.log(`📡 Resposta de comando do rastreador ${rastreadorId}:`, data);
      
      // Aqui você pode implementar lógica específica para cada tipo de comando
      if (data.comando === 'bloqueio') {
        await this.updateRastreadorStatus(rastreadorId, {
          statusBloqueio: data.status,
          ultimaComando: new Date()
        });
      }
    } catch (error) {
      console.error('❌ Erro ao processar resposta de comando:', error);
    }
  }

  /**
   * Configura processamento em lote
   */
  private setupBatchProcessing(): void {
    // Processar dados em lote a cada X segundos
    setInterval(() => {
      if (this.locationDataCache.size > 0) {
        this.processBatchUpdate();
      }
    }, this.batchTimeout);
  }

  /**
   * Processa atualizações em lote
   */
  private async processBatchUpdate(): Promise<void> {
    if (this.locationDataCache.size === 0) return;

    try {
      const batchData = Array.from(this.locationDataCache.values());
      this.locationDataCache.clear();

      console.log(`📦 Processando ${batchData.length} atualizações em lote`);

      // Processar cada localização individualmente para garantir atomicidade
      const promises = batchData.map(locationData => 
        this.saveLocationToFirebase(locationData)
      );

      await Promise.allSettled(promises);
      console.log('✅ Lote processado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao processar lote:', error);
      
      // Recolocar dados no cache em caso de erro
      batchData.forEach(data => {
        this.locationDataCache.set(data.rastreadorId, data);
      });
    }
  }

  /**
   * Salva dados de localização no Firebase
   */
  private async saveLocationToFirebase(locationData: LocationData): Promise<void> {
    try {
      const { rastreadorId, ...data } = locationData;
      
      // Salvar no histórico de localizações
      const historicoRef = collection(db, 'rastreadores', rastreadorId, 'historico');
      await addDoc(historicoRef, {
        ...data,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Atualizar localização atual
      const rastreadorRef = doc(db, 'rastreadores', rastreadorId);
      await updateDoc(rastreadorRef, {
        localizacaoAtual: {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: serverTimestamp()
        },
        ultimaAtualizacao: serverTimestamp()
      });

    } catch (error) {
      console.error('❌ Erro ao salvar no Firebase:', error);
      throw error;
    }
  }

  /**
   * Atualiza status do rastreador
   */
  private async updateRastreadorStatus(rastreadorId: string, statusData: any): Promise<void> {
    try {
      const rastreadorRef = doc(db, 'rastreadores', rastreadorId);
      await updateDoc(rastreadorRef, {
        ...statusData,
        ultimaAtualizacao: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar status do rastreador:', error);
    }
  }

  /**
   * Envia comando para rastreador
   */
  public async sendCommand(rastreadorId: string, command: any, qos: number = 1): Promise<boolean> {
    try {
      const topic = `rastreadores/${rastreadorId}/comando`;
      const message = JSON.stringify({
        ...command,
        timestamp: Date.now(),
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      if (this.isConnected && this.client) {
        this.client.publish(topic, message, { qos });
        console.log(`📤 Comando enviado para ${rastreadorId}:`, command);
        return true;
      } else {
        // Adicionar à fila se não estiver conectado
        this.messageQueue.push({ topic, message, qos });
        console.log(`📋 Comando adicionado à fila para ${rastreadorId}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao enviar comando:', error);
      return false;
    }
  }

  /**
   * Envia dados de localização (para testes ou simulação)
   */
  public async sendLocationData(rastreadorId: string, locationData: Partial<LocationData>): Promise<boolean> {
    try {
      const topic = `rastreadores/${rastreadorId}/localizacao`;
      const message = JSON.stringify({
        ...locationData,
        timestamp: Date.now()
      });

      if (this.isConnected && this.client) {
        this.client.publish(topic, message, { qos: 1 });
        return true;
      } else {
        this.messageQueue.push({ topic, message, qos: 1 });
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao enviar dados de localização:', error);
      return false;
    }
  }

  /**
   * Processa fila de mensagens pendentes
   */
  private processMessageQueue(): void {
    if (!this.isConnected || !this.client || this.messageQueue.length === 0) return;

    console.log(`📋 Processando ${this.messageQueue.length} mensagens da fila`);

    while (this.messageQueue.length > 0) {
      const { topic, message, qos } = this.messageQueue.shift()!;
      this.client!.publish(topic, message, { qos });
    }
  }

  /**
   * Desconecta do broker MQTT
   */
  public disconnect(): void {
    // Limpar timers de reconexão
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Parar processo de reconexão
    this.isReconnecting = false;
    
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      console.log('🔌 MQTT desconectado');
    }
  }

  /**
   * Verifica se está conectado
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Força uma nova tentativa de conexão (reset do contador)
   */
  public forceReconnect(): void {
    console.log('🔄 Forçando nova tentativa de conexão...');
    
    // Limpar timers existentes
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Reset contadores
    this.reconnectAttempts = 0;
    this.reconnectDelay = 5000;
    this.isReconnecting = false;
    
    // Desconectar e tentar conectar novamente
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  /**
   * Obtém estatísticas da conexão
   */
  public getStats(): {
    isConnected: boolean;
    queueSize: number;
    cacheSize: number;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      queueSize: this.messageQueue.length,
      cacheSize: this.locationDataCache.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Instância singleton do serviço
export const mqttService = new MQTTService();
export default MQTTService;
