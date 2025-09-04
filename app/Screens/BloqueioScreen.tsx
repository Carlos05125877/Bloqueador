import Header from '@/components/Header';
import SelectRastrador from '@/components/SelectRastrador';
import { doc, getDoc } from 'firebase/firestore';
import type { MqttClient } from 'mqtt';
import mqtt from 'mqtt';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

// Configurações do broker MQTT
// Para React Native (e Expo), é comum usar WebSockets (porta 8000 para HiveMQ)

const MQTT_BROKER = 'ws://broker.hivemq.com:8000/mqtt';
const MQTT_CLIENT_ID = 'ContourlineRastrador_' + Math.random().toString(16).substr(2, 8); // ID único para o cliente MQTT

const DISPONIVEIS = ['0407250001', '1234567890']; // Exemplo de lista de rastreadores

const App = () => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState('Desconhecido');
  const [loading, setLoading] = useState(true);
  const [selectedRastreador, setSelectedRastreador] = useState(DISPONIVEIS[0]); // Estado para o rastreador selecionado
  const [equipamento, setEquipamento] = useState<any>(null);
  const [equipamentoLoading, setEquipamentoLoading] = useState(false);

  // O tópico agora depende do rastreador selecionado
  const MQTT_COMMAND_TOPIC = `rastreador/comandos/${selectedRastreador}`;

  // Buscar dados do equipamento ao selecionar rastreador
  useEffect(() => {
    const fetchEquipamento = async () => {
      setEquipamento(null);
      if (!selectedRastreador) return;
      setEquipamentoLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;
        const rastreadorRef = doc(db, 'users', user.uid, 'rastradores', selectedRastreador);
        const rastreadorSnap = await getDoc(rastreadorRef);
        if (rastreadorSnap.exists()) {
          const data = rastreadorSnap.data();
          if (data.equipamentoVinculado) {
            setEquipamento({ ...data.equipamentoVinculado, rastreadorVinculado: selectedRastreador });
          }
        }
      } finally {
        setEquipamentoLoading(false);
      }
    };
    fetchEquipamento();
  }, [selectedRastreador]);

  useEffect(() => {
    // Conecta ao broker MQTT
    const mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: MQTT_CLIENT_ID,
      clean: true, // Limpa sessões anteriores
      reconnectPeriod: 1000, // Tenta reconectar a cada 1 segundo
      protocol: 'ws',
    });

    // Evento de conexão bem-sucedida
    mqttClient.on('connect', () => {
      console.log('✅ Conectado ao broker MQTT');
      setIsConnected(true);
      setLoading(false);
    });

    // Evento de erro de conexão
    mqttClient.on('error', (err) => {
      console.error('❌ Erro de conexão MQTT:', err);
      setIsConnected(false);
      setLoading(false);
    });

    // Evento de fechamento de conexão
    mqttClient.on('close', () => {
      console.log('🔌 Conexão MQTT fechada');
      setIsConnected(false);
      setLoading(false);
    });

    // Evento de reconexão
    mqttClient.on('reconnect', () => {
      console.log('🔄 Tentando reconectar ao MQTT...');
      setLoading(true);
      setIsConnected(false);
    });

    // Evento de desconexão
    mqttClient.on('disconnect', () => {
      console.log('📡 Desconectado do broker MQTT');
      setIsConnected(false);
      setLoading(false);
    });

    // Evento de mensagens recebidas (debug)
    mqttClient.on('message', (topic, message) => {
      console.log('Mensagem recebida:', topic, message.toString());
      
      // Atualiza status do equipamento baseado nas mensagens recebidas
      if (topic === `rastreador/status/${selectedRastreador}`) {
        const status = message.toString();
        if (status === 'BLOQUEADO') {
          setLedState('Bloqueado');
        } else if (status === 'DESBLOQUEADO') {
          setLedState('Desbloqueado');
        }
      }
    });

    setClient(mqttClient);

    // Verifica estado inicial da conexão
    if (mqttClient.connected) {
      console.log('✅ Cliente MQTT já conectado inicialmente');
      setIsConnected(true);
      setLoading(false);
    } else {
      console.log('❌ Cliente MQTT não conectado inicialmente');
      setIsConnected(false);
      setLoading(false);
    }

    // Limpeza ao desmontar o componente
    return () => {
      if (mqttClient) {
        mqttClient.end();
        console.log('🔌 Cliente MQTT desconectado.');
      }
    };
  }, []); // O array vazio garante que este useEffect seja executado apenas uma vez ao montar

  // Função para publicar comandos MQTT com sistema de comandos pendentes
  const publishCommand = (command: string) => {
    console.log(`=== DEBUG: Enviando Comando ===`);
    console.log(`Comando: ${command}`);
    console.log(`Rastreador: ${selectedRastreador}`);
    console.log(`===============================`);
    
    // SEMPRE envia o comando diretamente para o ESP32
    console.log(`📡 Enviando comando direto para ESP32: ${command}`);
    
    if (client && client.connected) {
      // Envia comando direto e aguarda confirmação
      sendDirectCommandWithConfirmation(command);
    } else {
      console.log('🚫 Cliente MQTT não disponível - enviando como pendente');
      sendAsPendingCommand(command);
    }
  };

  // Função para enviar comando direto e aguardar confirmação
  const sendDirectCommandWithConfirmation = (command: string) => {
    if (!client) {
      console.log('❌ Cliente MQTT não disponível');
      sendAsPendingCommand(command);
      return;
    }
    
    console.log(`🔄 Enviando comando direto e aguardando confirmação: ${command}`);
    
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
        console.error('❌ Falha ao enviar comando direto:', err);
        sendAsPendingCommand(command);
        return;
      }
      
      console.log('✅ Comando enviado, aguardando confirmação...');
      
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
            
                  // Remove listener temporário
      if (client) {
        client.removeListener('message', confirmationListener);
      }
      
      // Atualiza estado
      setLedState(command === 'ON' ? 'Bloqueado' : 'Desbloqueado');
      Alert.alert('Comando Executado', `Comando "${command}" executado com sucesso pelo ESP32!`);
          }
        } catch (error) {
          console.log('⚠️ Mensagem recebida não é confirmação válida');
        }
      };
      
      // Adiciona listener para confirmação
      if (client) {
        client.on('message', confirmationListener);
      }
    });
  };

  // Função auxiliar para enviar comandos pendentes
  const sendAsPendingCommand = (command: string) => {
    console.log(`💾 Enviando comando como pendente: ${command}`);
    
    // Cria comando pendente
    const pendingCommand = {
      command: command,
      timestamp: Date.now().toString(),
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      device_id: selectedRastreador,
      status: 'pending'
    };
    
    // Atualiza estado local
    setLedState(command === 'ON' ? 'Bloqueado' : 'Desbloqueado');
    
    // Mostra mensagem de comando pendente
    Alert.alert(
      'Comando Pendente', 
      `Comando "${command}" enviado como pendente. O ESP32 executará quando se conectar.`,
      [
        {
          text: 'OK',
          onPress: () => {
            console.log('💾 Comando pendente processado:', pendingCommand);
          }
        }
      ]
    );
    
    // SEMPRE envia para o tópico de comandos pendentes (mesmo se app offline depois)
    if (client && client.connected) {
      const pendingTopic = `rastreador/comandos_pendentes/${selectedRastreador}`;
      client.publish(pendingTopic, JSON.stringify(pendingCommand), (err) => {
        if (err) {
          console.log('❌ Falha ao enviar comando pendente para broker');
        } else {
          console.log('✅ Comando pendente enviado para broker com sucesso');
        }
      });
    } else {
      console.log('🚫 Broker MQTT não disponível - comando salvo apenas localmente');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Bloqueio/Desbloqueio"/>
      <View style={styles.header}>
        <Text style={styles.status}>
          Status: {isConnected ? 'Conectado' : 'Desconectado'}
        </Text>
        {loading && <ActivityIndicator size="small" color="#007bff" style={styles.activityIndicator} />}
        <SelectRastrador
          selected={selectedRastreador}
          onSelect={setSelectedRastreador}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonOff]}
          onPress={() => publishCommand('OFF')}
          disabled={false} // Sempre habilitado - sistema de comandos pendentes cuida do offline
        >
          <Text style={styles.buttonText}>Bloquear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonOn]}
          onPress={() => publishCommand('ON')}
          disabled={false} // Sempre habilitado - sistema de comandos pendentes cuida do offline
        >
          <Text style={styles.buttonText}>Desbloquear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Número do Rastreador: {selectedRastreador}</Text>
        {equipamentoLoading ? (
          <ActivityIndicator size="small" color="#007bff" />
        ) : equipamento ? (
          <>
            <Text style={styles.infoText}>Modelo do Equipamento: {equipamento.modeloEquipamento}</Text>
            <Text style={styles.infoText}>Número de Série: {equipamento.numeroSerie}</Text>
            <Text style={styles.infoText}>Pedido de Venda / Ordem de Produção: {equipamento.numeroPedido}</Text>
            <Text style={styles.infoText}>Data de Instalação: {equipamento.dataInstalacao}</Text>
            <Text style={styles.infoText}>Técnico Instalador: {equipamento.tecnico}</Text>
            <Text style={styles.infoText}>Estado do Equipamento: {ledState}</Text>
          </>
        ) : (
          <Text style={styles.infoText}>Nenhum equipamento vinculado a este rastreador.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  status: {
    fontSize: 18,
    color: '#34495e',
    marginBottom: 10,
  },
  activityIndicator: {
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 50,
    paddingHorizontal: 20,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5, // Sombra para Android
    shadowColor: '#000', // Sombra para iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 150,
  },
  buttonOn: {
    backgroundColor: '#28a745', // Verde para ON
  },
  buttonOff: {
    backgroundColor: '#dc3545', // Vermelho para OFF
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginRight: 'auto',
    marginLeft: 'auto',
    backgroundColor: '#e9ecef',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  infoText: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 8,
  },
  infoTextSmall: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default App;
