import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Mapbox from '@rnmapbox/maps';
import mqtt from 'mqtt'; // Importa a biblioteca MQTT
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// Configura o token de acesso do Mapbox
Mapbox.setAccessToken('pk.eyJ1IjoiY2FybG9zb3V6YTA1IiwiYSI6ImNtY2phZnl5NDAyNXoya3B6NGViaTI0MTAifQ.A1Yve7Y4anf6HhIC1sGdUQ');

// O componente Mapa agora aceita a prop rastreadorId com tipo explícito
const Mapa = ({ rastreadorId }: { rastreadorId: string }) => {
  // Define os estados para latitude e longitude, inicialmente nulos ou com um valor padrão
  // Usamos as coordenadas de Sete Lagoas como padrão inicial enquanto aguardamos os dados do GPS
  const [latitude, setLatitude] = useState(-19.47922020);
  const [longitude, setLongitude] = useState(-44.2476992);
  const [isGpsDataReceived, setIsGpsDataReceived] = useState(false);
  const [mqttStatus, setMqttStatus] = useState('Conectando ao MQTT...');

  useEffect(() => {
    let client; // Declara a variável client fora do try-catch para que possa ser acessada no cleanup

    // Verifica se um rastreadorId foi fornecido antes de tentar conectar ao MQTT
    if (!rastreadorId) {
      setMqttStatus('Aguardando a seleção do rastreador...');
      return; // Sai do useEffect se não houver rastreadorId
    }

    // Constrói o tópico MQTT usando o rastreadorId
    const mqttTopic = `rastreador/gps/${rastreadorId}`;
    console.log(`Tentando conectar e assinar o tópico: ${mqttTopic}`);

    // Configura as opções do cliente MQTT
    client = mqtt.connect('ws://broker.hivemq.com:8000/mqtt'); // Usando WebSockets para React Native

    // Evento de conexão bem-sucedida
    client.on('connect', () => {
      console.log('Conectado ao broker MQTT!');
      setMqttStatus('Conectado ao MQTT.');
      // Assina o tópico de GPS dinamicamente
      client.subscribe(mqttTopic, (err) => {
        if (!err) {
          console.log(`Assinado ao tópico ${mqttTopic}`);
        } else {
          console.error('Falha ao assinar tópico:', err);
          setMqttStatus('Erro ao assinar tópico.');
        }
      });
    });

    // Evento de recebimento de mensagem
    client.on('message', (topic, message) => {
      console.log(`Mensagem recebida no tópico ${topic}: ${message.toString()}`);
      try {
        const data = JSON.parse(message.toString());
        if (data.latitude && data.longitude) {
          setLatitude(parseFloat(data.latitude));
          setLongitude(parseFloat(data.longitude));
          setIsGpsDataReceived(true);
          setMqttStatus('Dados GPS recebidos.');
        }
      } catch (e) {
        console.error('Erro ao analisar mensagem JSON:', e);
        setMqttStatus('Erro ao receber dados GPS.');
      }
    });

    // Evento de erro
    client.on('error', (err) => {
      console.error('Erro MQTT:', err);
      setMqttStatus(`Erro MQTT: ${err.message}`);
      if (client && client.connected) {
        client.end(); // Fecha a conexão em caso de erro
      }
    });

    // Evento de desconexão
    client.on('close', () => {
      console.log('Desconectado do broker MQTT.');
      setMqttStatus('Desconectado do MQTT.');
    });

    // Limpeza ao desmontar o componente ou quando rastreadorId muda
    return () => {
      if (client && client.connected) {
        console.log('Desconectando do MQTT para limpeza...');
        client.end();
      }
    };
  }, [rastreadorId]); // Adiciona rastreadorId como dependência para re-executar quando ele mudar

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        {!isGpsDataReceived && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>{mqttStatus}</Text>
            {rastreadorId ? (
              <Text style={styles.loadingText}>Aguardando dados GPS para {rastreadorId}...</Text>
            ) : (
              <Text style={styles.loadingText}>Selecione um rastreador para ver a localização.</Text>
            )}
          </View>
        )}
        <Mapbox.MapView style={styles.map}>
          {/* A câmera e o marcador só serão renderizados se tivermos uma latitude/longitude válida */}
          {latitude !== null && longitude !== null && (
            <>
              <Mapbox.Camera
                zoomLevel={12}
                centerCoordinate={[longitude, latitude]}
                animationMode="flyTo" // Adiciona uma animação suave ao mover o mapa
                animationDuration={2000} // Duração da animação em milissegundos
              />
              <Mapbox.PointAnnotation
                id="LocalizacaoAtual" // ID único para o marcador
                coordinate={[longitude, latitude]}
              >
                {/* Ícone personalizado para a localização */}
                <MaterialIcons name="person-pin-circle" size={30} color="red" />
                <Text style={{ color: 'black', fontSize: 12, textAlign: 'center' }}>
                  {/* Você pode adicionar texto aqui se desejar, por exemplo, o ID do rastreador */}
                </Text>
              </Mapbox.PointAnnotation>
            </>
          )}
        </Mapbox.MapView>
      </View>
    </View>
  );
}

export default Mapa;

const styles = StyleSheet.create({
  page: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  container: {
    width: 350,
    height: 300,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Fundo semi-transparente
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Garante que fique acima do mapa
    borderRadius: 15,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});
