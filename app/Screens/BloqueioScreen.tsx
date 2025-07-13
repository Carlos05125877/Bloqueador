import Header from '@/components/Header';
import SelectRastrador from '@/components/SelectRastrador';
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

// Configurações do broker MQTT
// Para React Native (e Expo), é comum usar WebSockets (porta 8000 para HiveMQ)
const MQTT_BROKER = 'ws://broker.hivemq.com:8000/mqtt';
const MQTT_CLIENT_ID = 'ContourlineRastrador'; // ID único para o cliente MQTT

const DISPONIVEIS = ['0407250001', '1234567890']; // Exemplo de lista de rastreadores

const App = () => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ledState, setLedState] = useState('Desconhecido');
  const [loading, setLoading] = useState(true);
  const [selectedRastreador, setSelectedRastreador] = useState(DISPONIVEIS[0]); // Estado para o rastreador selecionado

  // O tópico agora depende do rastreador selecionado
  const MQTT_COMMAND_TOPIC = `rastreador/comandos/${selectedRastreador}`;

  useEffect(() => {
    // Conecta ao broker MQTT
    const mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: MQTT_CLIENT_ID,
      clean: true, // Limpa sessões anteriores
      reconnectPeriod: 1000, // Tenta reconectar a cada 1 segundo
      // Para alguns ambientes, pode ser necessário especificar o protocolo
      protocol: 'ws',
      // No React Native, o hostname pode precisar ser o IP se não estiver usando um broker público
      // host: 'seu_ip_local_do_broker', // Exemplo: '192.168.1.100'
      // port: 8000,
    });

    // Evento de conexão bem-sucedida
    mqttClient.on('connect', () => {
      setIsConnected(true);
      setLoading(false);
      Alert.alert('Conectado', 'Conectado ao broker MQTT!');
      console.log('Conectado ao broker MQTT');
    });

    // Evento de erro de conexão
    mqttClient.on('error', (err) => {
      console.error('Erro de conexão MQTT:', err);
      Alert.alert('Erro de Conexão', 'Não foi possível conectar ao broker MQTT. Verifique sua conexão ou o broker.');
      setIsConnected(false);
      setLoading(false);
    });

    // Evento de fechamento de conexão
    mqttClient.on('close', () => {
      console.log('Conexão MQTT fechada');
      setIsConnected(false);
      setLoading(false);
    });

    // Evento de reconexão
    mqttClient.on('reconnect', () => {
      console.log('Tentando reconectar ao MQTT...');
      setLoading(true);
    });

    setClient(mqttClient);

    // Limpeza ao desmontar o componente
    return () => {
      if (mqttClient) {
        mqttClient.end();
        console.log('Cliente MQTT desconectado.');
      }
    };
  }, []); // O array vazio garante que este useEffect seja executado apenas uma vez ao montar

  // Função para publicar comandos MQTT
  const publishCommand = (command: string) => {
    if (client && isConnected) {
      console.log(`Publicando comando: ${command} no tópico: ${MQTT_COMMAND_TOPIC}`);
      client.publish(MQTT_COMMAND_TOPIC, command, (err) => {
        if (err) {
          console.error('Falha ao publicar mensagem:', err);
          Alert.alert('Erro de Publicação', 'Não foi possível enviar o comando.');
        } else {
          setLedState(command === 'ON' ? 'Desbloqueado' : 'Bloqueado');
          Alert.alert('Comando Enviado', `Comando "${command}" enviado com sucesso!`);
        }
      });
    } else {
      Alert.alert('Erro', 'Não conectado ao broker MQTT.');
      console.warn('Não conectado ao broker MQTT para publicar.');
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
          disabled={!isConnected} // Desabilita o botão se não estiver conectado
        >
          <Text style={styles.buttonText}>Bloquear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonOn]}
          onPress={() => publishCommand('ON')}
          disabled={!isConnected} // Desabilita o botão se não estiver conectado
        >
          <Text style={styles.buttonText}>Desbloquear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Estado do Equipamento (Último comando): {ledState}</Text>
        <Text style={styles.infoText}>Tópico de Comando: {MQTT_COMMAND_TOPIC}</Text>
        <Text style={styles.infoText}>Broker MQTT: {MQTT_BROKER}</Text>
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
