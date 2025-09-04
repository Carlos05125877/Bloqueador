import { useCallback, useEffect, useRef, useState } from 'react';
import { LocationData, MQTTConfig, mqttService } from '../services/MQTTService';

export interface MQTTStats {
  isConnected: boolean;
  queueSize: number;
  cacheSize: number;
  reconnectAttempts: number;
}

export interface MQTTState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  stats: MQTTStats;
}

export const useMQTT = (config?: Partial<MQTTConfig>) => {
  const [state, setState] = useState<MQTTState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    stats: mqttService.getStats()
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para conectar ao MQTT
  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));
      
      const success = await mqttService.connect(config);
      
      if (success) {
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false,
          error: null 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isConnecting: false,
          error: 'Falha ao conectar ao broker MQTT' 
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }));
    }
  }, [config]);

  // Função para desconectar
  const disconnect = useCallback(() => {
    mqttService.disconnect();
    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isConnecting: false 
    }));
  }, []);

  // Função para enviar comando
  const sendCommand = useCallback(async (
    rastreadorId: string, 
    command: any, 
    qos: number = 1
  ): Promise<boolean> => {
    if (!state.isConnected) {
      setState(prev => ({ 
        ...prev, 
        error: 'Não conectado ao MQTT' 
      }));
      return false;
    }

    try {
      const success = await mqttService.sendCommand(rastreadorId, command, qos);
      if (!success) {
        setState(prev => ({ 
          ...prev, 
          error: 'Falha ao enviar comando' 
        }));
      }
      return success;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao enviar comando' 
      }));
      return false;
    }
  }, [state.isConnected]);

  // Função para enviar dados de localização
  const sendLocationData = useCallback(async (
    rastreadorId: string, 
    locationData: Partial<LocationData>
  ): Promise<boolean> => {
    if (!state.isConnected) {
      setState(prev => ({ 
        ...prev, 
        error: 'Não conectado ao MQTT' 
      }));
      return false;
    }

    try {
      const success = await mqttService.sendLocationData(rastreadorId, locationData);
      if (!success) {
        setState(prev => ({ 
          ...prev, 
          error: 'Falha ao enviar dados de localização' 
        }));
      }
      return success;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao enviar dados de localização' 
      }));
      return false;
    }
  }, [state.isConnected]);

  // Função para limpar erro
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Função para reconectar
  const reconnect = useCallback(async () => {
    disconnect();
    
    // Aguardar um pouco antes de reconectar
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(async () => {
      await connect();
    }, 2000);
  }, [connect, disconnect]);

  // Função para forçar reconexão (reset do contador)
  const forceReconnect = useCallback(() => {
    console.log('🔄 Forçando reconexão...');
    mqttService.forceReconnect();
    
    // Resetar estado local
    setState(prev => ({ 
      ...prev, 
      error: null,
      isConnecting: false 
    }));
  }, []);

  // Atualizar estatísticas periodicamente
  useEffect(() => {
    statsIntervalRef.current = setInterval(() => {
      const stats = mqttService.getStats();
      setState(prev => ({ 
        ...prev, 
        isConnected: stats.isConnected,
        stats 
      }));
    }, 1000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, []);

  // Conectar automaticamente ao montar o componente
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconectar automaticamente em caso de erro (com delay maior)
  useEffect(() => {
    if (state.error && !state.isConnected && !state.isConnecting) {
      const timeout = setTimeout(() => {
        console.log('🔄 Tentando reconexão automática após erro...');
        reconnect();
      }, 10000); // Aumentar para 10 segundos

      return () => clearTimeout(timeout);
    }
  }, [state.error, state.isConnected, state.isConnecting, reconnect]);

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    forceReconnect,
    sendCommand,
    sendLocationData,
    clearError
  };
};
