import Mapbox from '@rnmapbox/maps';
import mqtt from 'mqtt'; // Importa a biblioteca MQTT
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../app/firebase/firebaseConfig';

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

  // Localização padrão - Sete Lagoas, MG
  const LOCALIZACAO_PADRAO = {
    latitude: -19.47922020,
    longitude: -44.2476992
  };

  // Função para salvar localização no Firestore
  const salvarLocalizacao = async (rastreadorId: string, latitude: number, longitude: number) => {
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid, 'rastradores', rastreadorId),
          {
            numeroRastreador: rastreadorId,
            ultimaLatitude: latitude,
            ultimaLongitude: longitude,
            ultimaAtualizacao: new Date().toISOString()
          },
          { merge: true }
        );
        console.log(`Localização salva para ${rastreadorId}:`, { latitude, longitude });
      }
    } catch (error) {
      console.error(`Erro ao salvar localização para ${rastreadorId}:`, error);
    }
  };

  // Função para carregar localização salva
  const carregarLocalizacaoSalva = async (rastreadorId: string) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'users', user.uid, 'rastradores', rastreadorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.ultimaLatitude && data.ultimaLongitude) {
            setLatitude(data.ultimaLatitude);
            setLongitude(data.ultimaLongitude);
            setIsGpsDataReceived(true);
            console.log(`Localização carregada para ${rastreadorId}:`, { latitude: data.ultimaLatitude, longitude: data.ultimaLongitude });
          } else {
            // Se não tem dados salvos, usar localização padrão
            setLatitude(LOCALIZACAO_PADRAO.latitude);
            setLongitude(LOCALIZACAO_PADRAO.longitude);
            setIsGpsDataReceived(true);
            console.log(`Usando localização padrão para ${rastreadorId}:`, LOCALIZACAO_PADRAO);
          }
        } else {
          // Se o documento não existe, usar localização padrão
          setLatitude(LOCALIZACAO_PADRAO.latitude);
          setLongitude(LOCALIZACAO_PADRAO.longitude);
          setIsGpsDataReceived(true);
          console.log(`Usando localização padrão para ${rastreadorId}:`, LOCALIZACAO_PADRAO);
        }
      }
    } catch (error) {
      console.log(`Erro ao carregar localização salva para ${rastreadorId}:`, error);
      // Em caso de erro, usar localização padrão
      setLatitude(LOCALIZACAO_PADRAO.latitude);
      setLongitude(LOCALIZACAO_PADRAO.longitude);
      setIsGpsDataReceived(true);
      console.log(`Usando localização padrão para ${rastreadorId}:`, LOCALIZACAO_PADRAO);
    }
  };

  useEffect(() => {
    let client; // Declara a variável client fora do try-catch para que possa ser acessada no cleanup

    // Verifica se um rastreadorId foi fornecido antes de tentar conectar ao MQTT
    if (!rastreadorId) {
      setMqttStatus('Aguardando a seleção do rastreador...');
      return; // Sai do useEffect se não houver rastreadorId
    }

    // Carregar localização salva primeiro
    carregarLocalizacaoSalva(rastreadorId);

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
          const lat = parseFloat(data.latitude);
          const lng = parseFloat(data.longitude);
          setLatitude(lat);
          setLongitude(lng);
          setIsGpsDataReceived(true);
          setMqttStatus('Dados GPS recebidos.');
          
          // Salvar localização no Firestore
          salvarLocalizacao(rastreadorId, lat, lng);
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
          <Mapbox.Camera
            zoomLevel={12}
            centerCoordinate={[longitude, latitude]}
            animationMode="flyTo"
            animationDuration={2000}
          />
          <Mapbox.PointAnnotation
            id="LocalizacaoAtual"
            coordinate={[longitude, latitude]}
          >
            <Text style={styles.markerText}>
              {rastreadorId || 'Localização Padrão'}
            </Text>
          </Mapbox.PointAnnotation>
        </Mapbox.MapView>
      </View>
    </View>
  );
}

// Novo componente para mostrar todos os rastreadores do usuário logado
const MapaTodosRastreadores = ({ mapStyle = 'streets', refreshKey, rastreadorSelecionado }: { mapStyle?: 'streets' | 'satellite', refreshKey?: number, rastreadorSelecionado?: string | null }) => {
  const [rastreadorList, setRastreadorList] = React.useState<string[]>([]);
  const [localizacoes, setLocalizacoes] = React.useState<{ [id: string]: { latitude: number, longitude: number } }>({});
  const [loading, setLoading] = React.useState(true);
  const [mqttStatus, setMqttStatus] = React.useState('Conectando ao MQTT...');
  const [isGpsDataReceived, setIsGpsDataReceived] = React.useState(false);
  const mqttClients = React.useRef<{ [id: string]: any }>({});
  const router = useRouter();

  // Localização padrão - Sete Lagoas, MG
  const LOCALIZACAO_PADRAO = {
    latitude: -19.47922020,
    longitude: -44.2476992
  };

  React.useEffect(() => {
    // Buscar rastreadores do usuário logado
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDocs(collection(db, 'users', user.uid, 'rastradores'));
        const lista = snap.docs.map(doc => doc.data().numeroRastreador);
        setRastreadorList(lista);
        
        // Carregar localizações salvas do Firestore ou usar padrão
        const localizacoesSalvas: { [id: string]: { latitude: number, longitude: number } } = {};
        for (const rastreadorId of lista) {
          try {
            const docRef = doc(db, 'users', user.uid, 'rastradores', rastreadorId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.ultimaLatitude && data.ultimaLongitude) {
                localizacoesSalvas[rastreadorId] = {
                  latitude: data.ultimaLatitude,
                  longitude: data.ultimaLongitude
                };
              } else {
                // Se não tem dados salvos, usar localização padrão
                localizacoesSalvas[rastreadorId] = LOCALIZACAO_PADRAO;
              }
            } else {
              // Se o documento não existe, usar localização padrão
              localizacoesSalvas[rastreadorId] = LOCALIZACAO_PADRAO;
            }
          } catch (error) {
            console.log(`Erro ao carregar localização salva para ${rastreadorId}:`, error);
            // Em caso de erro, usar localização padrão
            localizacoesSalvas[rastreadorId] = LOCALIZACAO_PADRAO;
          }
        }
        setLocalizacoes(localizacoesSalvas);
        setIsGpsDataReceived(lista.length > 0);
      } else {
        setRastreadorList([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshKey]);

  // Função para salvar localização no Firestore
  const salvarLocalizacao = async (rastreadorId: string, latitude: number, longitude: number) => {
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid, 'rastradores', rastreadorId),
          {
            numeroRastreador: rastreadorId,
            ultimaLatitude: latitude,
            ultimaLongitude: longitude,
            ultimaAtualizacao: new Date().toISOString()
          },
          { merge: true }
        );
        console.log(`Localização salva para ${rastreadorId}:`, { latitude, longitude });
      }
    } catch (error) {
      console.error(`Erro ao salvar localização para ${rastreadorId}:`, error);
    }
  };

  React.useEffect(() => {
    // Limpar conexões MQTT antigas
    Object.values(mqttClients.current).forEach(client => {
      if (client && client.connected) client.end();
    });
    mqttClients.current = {};
    setMqttStatus('Conectando ao MQTT...');

    if (rastreadorList.length === 0) return;

    let receivedCount = 0;
    rastreadorList.forEach(rastreadorId => {
      const mqttTopic = `rastreador/gps/${rastreadorId}`;
      const client = mqtt.connect('ws://broker.hivemq.com:8000/mqtt');
      mqttClients.current[rastreadorId] = client;

      client.on('connect', () => {
        client.subscribe(mqttTopic, (err) => {
          if (!err) {
            setMqttStatus(`Assinado ao tópico ${mqttTopic}`);
          } else {
            setMqttStatus('Erro ao assinar tópico.');
          }
        });
      });

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.latitude && data.longitude) {
            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            
            setLocalizacoes(prev => ({ ...prev, [rastreadorId]: { latitude: lat, longitude: lng } }));
            
            // Salvar localização no Firestore
            salvarLocalizacao(rastreadorId, lat, lng);
            
            receivedCount++;
            if (receivedCount === rastreadorList.length) setIsGpsDataReceived(true);
            setMqttStatus('Dados GPS recebidos.');
          }
        } catch (e) {
          setMqttStatus('Erro ao receber dados GPS.');
        }
      });

      client.on('error', (err) => {
        setMqttStatus(`Erro MQTT: ${err.message}`);
        if (client && client.connected) client.end();
      });
      client.on('close', () => {
        setMqttStatus('Desconectado do MQTT.');
      });
    });

    return () => {
      Object.values(mqttClients.current).forEach(client => {
        if (client && client.connected) client.end();
      });
      mqttClients.current = {};
    };
  }, [rastreadorList, refreshKey]);

  // Centralizar o mapa na média das localizações ou usar localização padrão
  const coords = Object.values(localizacoes);
  let center: [number, number];
  if (
    rastreadorSelecionado &&
    localizacoes[rastreadorSelecionado]
  ) {
    center = [
      localizacoes[rastreadorSelecionado].longitude,
      localizacoes[rastreadorSelecionado].latitude,
    ];
  } else if (coords.length > 0) {
    center = [
      coords.reduce((sum, l) => sum + l.longitude, 0) / coords.length,
      coords.reduce((sum, l) => sum + l.latitude, 0) / coords.length,
    ];
  } else {
    center = [LOCALIZACAO_PADRAO.longitude, LOCALIZACAO_PADRAO.latitude];
  }

  return (
    <View style={styles.page}>
      <View style={styles.fullScreenMap}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Carregando rastreadores...</Text>
          </View>
        )}
        {!loading && coords.length === 0 && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Nenhum rastreador encontrado.</Text>
            <Text style={styles.loadingText}>Localização: Sete Lagoas, MG</Text>
          </View>
        )}
        <Mapbox.MapView
          style={styles.map}
          styleURL={
            mapStyle === 'satellite'
              ? Mapbox.StyleURL.Satellite
              : Mapbox.StyleURL.Street
          }
        >
          <Mapbox.Camera
            zoomLevel={rastreadorSelecionado ? 15 : 8}
            centerCoordinate={center}
            animationMode="flyTo"
            animationDuration={2000}
          />
          {Object.entries(localizacoes).map(([id, loc]) => (
            <Mapbox.PointAnnotation
              key={String(id)}
              id={String(id)}
              coordinate={[loc.longitude, loc.latitude]}
              onSelected={async () => {
                // Buscar o equipamento vinculado ao rastreador (id)
                try {
                  const user = auth.currentUser;
                  if (!user) {
                    alert('Usuário não autenticado.');
                    return;
                  }
                  const rastreadorRef = doc(db, 'users', user.uid, 'rastradores', String(id));
                  const rastreadorSnap = await getDoc(rastreadorRef);
                  if (rastreadorSnap.exists()) {
                    const data = rastreadorSnap.data();
                    console.log('Dados do rastreador:', data); // Log detalhado
                    if (data.equipamentoVinculado && data.equipamentoVinculado.numeroSerie) {
                      console.log('Numero de série encontrado:', data.equipamentoVinculado.numeroSerie);
                      router.push(`./DetalhesScreen?numeroSerie=${data.equipamentoVinculado.numeroSerie}`);
                    } else {
                      alert('Equipamento não vinculado a este rastreador.');
                    }
                  } else {
                    alert('Rastreador não encontrado.');
                  }
                } catch (e) {
                  alert('Erro ao buscar equipamento vinculado.');
                }
              }}
            >
              <Text style={styles.markerText}>{String(id)}</Text>
            </Mapbox.PointAnnotation>
          ))}
        </Mapbox.MapView>
      </View>
    </View>
  );
};

export { MapaTodosRastreadores };

export default Mapa;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F5FCFF',
  },
  fullScreenMap: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
  },
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  markerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: 'white',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ccc',
    textAlign: 'center',
  },
});
