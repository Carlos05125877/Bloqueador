import Mapbox from '@rnmapbox/maps';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../app/firebase/firebaseConfig';
import { useMQTT } from '../app/hooks/useMQTT';

// Configura o token de acesso do Mapbox
Mapbox.setAccessToken('pk.eyJ1IjoiY2FybG9zb3V6YTA1IiwiYSI6ImNtY2phZnl5NDAyNXoya3B6NGViaTI0MTAifQ.A1Yve7Y4anf6HhIC1sGdUQ');

// O componente Mapa agora aceita a prop rastreadorId com tipo explícito
// Usando a mesma abordagem simples do MapaTodosRastreadores que funciona sem erros
const Mapa = ({ rastreadorId, onError }: { rastreadorId: string, onError?: (error: string) => void }) => {
  const [latitude, setLatitude] = useState(-19.47922020);
  const [longitude, setLongitude] = useState(-44.2476992);
  const [isGpsDataReceived, setIsGpsDataReceived] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [velocidade, setVelocidade] = useState<number | undefined>();
  const [bateria, setBateria] = useState<number | undefined>();
  const [sinal, setSinal] = useState<number | undefined>();

  // Hook MQTT otimizado
  const { isConnected, sendCommand } = useMQTT();

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
    // Verifica se um rastreadorId foi fornecido
    if (!rastreadorId) {
      return;
    }

    console.log('Mapa: carregando localização para rastreador:', rastreadorId);
    carregarLocalizacaoSalva(rastreadorId);
  }, [rastreadorId]);

  // Função para lidar com o carregamento do mapa
  const onMapLoad = () => {
    console.log('Mapa: carregado com sucesso para rastreador:', rastreadorId);
    setMapReady(true);
  };

  // Função para lidar com erros do mapa
  const onMapError = (error: any) => {
    console.error('Mapa: erro no carregamento para rastreador:', rastreadorId, error);
    setMapReady(false);
    if (onError) {
      onError(error?.message || 'Erro desconhecido no mapa');
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        {!isGpsDataReceived ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>
              {isConnected ? 'Conectado ao MQTT' : 'Conectando ao MQTT...'}
            </Text>
            {rastreadorId ? (
              <Text style={styles.loadingText}>Aguardando dados GPS para {rastreadorId}...</Text>
            ) : (
              <Text style={styles.loadingText}>Selecione um rastreador para ver a localização.</Text>
            )}
          </View>
        ) : (
          <Mapbox.MapView 
            style={styles.map}
            onDidFinishLoadingMap={onMapLoad}
            onDidFailLoadingMap={() => onMapError('Falha ao carregar o mapa')}
            key={`map-${rastreadorId}`}
          >
            <Mapbox.Camera
              zoomLevel={12}
              centerCoordinate={[longitude, latitude]}
              animationMode="flyTo"
              animationDuration={2000}
            />
            {mapReady && (
              <Mapbox.PointAnnotation
                id={`LocalizacaoAtual-${rastreadorId}`}
                coordinate={[longitude, latitude]}
              >
                <View style={styles.markerContainer}>
                  <Text style={styles.markerText}>
                    {rastreadorId || 'Localização Padrão'}
                  </Text>
                </View>
              </Mapbox.PointAnnotation>
            )}
          </Mapbox.MapView>
        )}
      </View>
    </View>
  );
};

// Novo componente para mostrar todos os rastreadores do usuário logado
const MapaTodosRastreadores = ({ mapStyle = 'streets', refreshKey, rastreadorSelecionado, onError }: { mapStyle?: 'streets' | 'satellite', refreshKey?: number, rastreadorSelecionado?: string | null, onError?: (error: string) => void }) => {
  const [rastreadorList, setRastreadorList] = React.useState<string[]>([]);
  const [localizacoes, setLocalizacoes] = React.useState<{ [id: string]: { latitude: number, longitude: number } }>({});
  const [loading, setLoading] = React.useState(true);
  const [isGpsDataReceived, setIsGpsDataReceived] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const router = useRouter();

  const onMapError = (error: any) => {
    console.error('MapaTodosRastreadores: Erro no mapa:', error);
    if (onError) {
      onError(`Erro no mapa: ${error.message || error}`);
    }
  };

  // Resetar estados quando refreshKey muda
  React.useEffect(() => {
    setMapReady(false);
    setIsGpsDataReceived(false);
  }, [refreshKey]);
  
  // Hook MQTT otimizado
  const { isConnected } = useMQTT();

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
    if (rastreadorList.length === 0) return;

    // Simular dados de localização para todos os rastreadores
    // Em produção, isso seria substituído por dados reais do MQTT
    const interval = setInterval(() => {
      if (isConnected) {
        const mockLocalizacoes: { [id: string]: { latitude: number, longitude: number } } = {};
        
        rastreadorList.forEach(rastreadorId => {
          const mockLatitude = LOCALIZACAO_PADRAO.latitude + (Math.random() - 0.5) * 0.002;
          const mockLongitude = LOCALIZACAO_PADRAO.longitude + (Math.random() - 0.5) * 0.002;
          
          mockLocalizacoes[rastreadorId] = {
            latitude: mockLatitude,
            longitude: mockLongitude
          };
        });
        
        setLocalizacoes(mockLocalizacoes);
        setIsGpsDataReceived(true);
      }
    }, 15000); // Atualizar a cada 15 segundos

    return () => clearInterval(interval);
  }, [rastreadorList, refreshKey, isConnected]);

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
            <Text style={styles.loadingText}>
              MQTT: {isConnected ? 'Conectado' : 'Conectando...'}
            </Text>
          </View>
        )}
        {!loading && coords.length === 0 && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Nenhum rastreador encontrado.</Text>
            <Text style={styles.loadingText}>Localização: Sete Lagoas, MG</Text>
            <Text style={styles.loadingText}>
              MQTT: {isConnected ? 'Conectado' : 'Conectando...'}
            </Text>
          </View>
        )}
        <Mapbox.MapView
          style={styles.map}
          styleURL={
            mapStyle === 'satellite'
              ? Mapbox.StyleURL.Satellite
              : Mapbox.StyleURL.Street
          }
          onDidFinishLoadingMap={() => setMapReady(true)}
          onDidFailLoadingMap={() => onMapError('Falha ao carregar o mapa')}
          key={`map-all-${refreshKey || 0}`}
        >
          <Mapbox.Camera
            zoomLevel={rastreadorSelecionado ? 15 : 8}
            centerCoordinate={center}
            animationMode="flyTo"
            animationDuration={2000}
          />
          {Object.entries(localizacoes).map(([id, loc]) => (
            <Mapbox.PointAnnotation
              key={`marker-${id}-${loc.latitude}-${loc.longitude}`}
              id={`marker-${id}`}
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
              <View style={styles.markerContainer}>
                <Text style={styles.markerText}>{String(id)}</Text>
              </View>
            </Mapbox.PointAnnotation>
          ))}
        </Mapbox.MapView>
      </View>
    </View>
  );
};

// Componente de fallback para quando o mapa não estiver disponível
const MapFallback = ({ message }: { message: string }) => (
  <View style={styles.mapFallback}>
    <Text style={styles.fallbackText}>{message}</Text>
  </View>
);

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
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
  fallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
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
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
  },
});
