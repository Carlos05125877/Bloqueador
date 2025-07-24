import { MapaTodosRastreadores } from '@/components/mapa';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React from 'react';
import {
  SafeAreaView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

const HomeScreen = () => {
  const [mapStyle, setMapStyle] = React.useState<'streets' | 'satellite'>('streets');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [equipamentos, setEquipamentos] = React.useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [rastreadores, setRastreadores] = React.useState<string[]>([]);
  const [rastreadorSelecionado, setRastreadorSelecionado] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    getDocs(collection(db, 'users', userId, 'equipamentos')).then(snapshot => {
      setEquipamentos(snapshot.docs.map(doc => doc.data()));
    });
  }, [userId, refreshKey]);

  React.useEffect(() => {
    if (!userId) return;
    getDocs(collection(db, 'users', userId, 'rastradores')).then(snapshot => {
      setRastreadores(snapshot.docs.map(doc => doc.data().numeroRastreador));
    });
  }, [userId, refreshKey]);

  const filteredEquipamentos = search.trim().length > 0
    ? equipamentos.filter(e =>
        (e.modeloEquipamento || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.numeroSerie || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.rastreadorVinculado || '').toLowerCase().includes(search.toLowerCase())
      )
    : equipamentos;

  const filteredRastreadores = search.trim().length > 0
    ? rastreadores.filter(item => item.toLowerCase().includes(search.toLowerCase()))
    : rastreadores;

  const toggleMapStyle = () => {
    setMapStyle((prev) => (prev === 'streets' ? 'satellite' : 'streets'));
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullScreenMapWrapper}>
        <MapaTodosRastreadores mapStyle={mapStyle} refreshKey={refreshKey} rastreadorSelecionado={rastreadorSelecionado} />
      </View>
      <View style={styles.searchBarContainer}>
        <Feather name="search" size={20} color="#002845" style={{ marginLeft: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Dispositivos pelo número..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
      </View>
      {showSuggestions && filteredRastreadores.length > 0 && (
        <View style={styles.suggestionsBox}>
          {filteredRastreadores.map(numero => (
            <TouchableOpacity
              key={numero}
              style={styles.suggestionItem}
              onPress={() => {
                setShowSuggestions(false);
                setSearch('');
                setRastreadorSelecionado(numero); // Centraliza no rastreador
              }}
            >
              <Text style={styles.suggestionText}>{numero}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Botões flutuantes à esquerda sobre o mapa */}
      <View style={styles.floatingButtonsContainer}>
        <TouchableOpacity style={styles.floatingButton} onPress={handleRefresh}>
          <Feather name="refresh-cw" size={22} color="#002845" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatingButton} onPress={toggleMapStyle}>
          <Feather name="layers" size={22} color={mapStyle === 'satellite' ? '#007bff' : '#002845'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatingButton} onPress={() => router.push('./ConfiguracoesScreen')}>
          <Feather name="settings" size={22} color="#002845" />
        </TouchableOpacity>
      </View>
      {/* Barra inferior fixa sobre o mapa */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButton} onPress={async () => {
            try {
              await signOut(auth);
              router.replace('/'); // Redireciona para tela de login
            } catch (e) {
              alert('Erro ao sair.');
            }
          }}>
            <Feather name="log-out" size={22} color="#002845" />
            <Text style={styles.bottomButtonText}>sair</Text>
          </TouchableOpacity>
        <TouchableOpacity style={styles.bottomButton} onPress={() => router.push('./MenuScreen')}>
          <Feather name="menu" size={22} color="#002845" />
          <Text style={styles.bottomButtonText}>menu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  fullScreenMapWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  searchBarContainer: {
    position: 'absolute',
    top: 18,
    left: '4%',
    right: '4%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#002845',
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 10,
  },
  floatingButtonsContainer: {
    position: 'absolute',
    left: 18,
    top: 80,
    zIndex: 10,
    flexDirection: 'column',
    gap: 14,
  },
  floatingButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    
  },
  bottomButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 100,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 20,
    flexDirection: 'row',
    gap: 6,
  },
  bottomButtonText: {
    color: '#002845',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  suggestionsBox: {
    position: 'absolute',
    top: 62,
    left: '4%',
    right: '4%',
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
    maxHeight: 220,
    paddingVertical: 4,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    color: '#002845',
    fontSize: 15,
  },
});

export default HomeScreen;
