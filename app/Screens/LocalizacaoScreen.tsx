
import Header from '@/components/Header';
import Mapa from '@/components/mapa';
import SelectRastrador from '@/components/SelectRastrador';
import React, { useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View
} from 'react-native';

export default function LocalizacaoScreen() {
  const [selectedRastreador, setSelectedRastreador] = useState<string>('');
  const [mapError, setMapError] = useState<string | null>(null);

  const handleRastreadorSelect = (numero: string) => {
    console.log('LocalizacaoScreen: Rastreador selecionado:', numero);
    console.log('LocalizacaoScreen: Rastreador anterior:', selectedRastreador);
    setSelectedRastreador(numero);
    setMapError(null); // Limpar erro ao selecionar novo rastreador
    console.log('LocalizacaoScreen: Estado atualizado, renderizando mapa para:', numero);
  };

  const handleMapError = (error: string) => {
    console.error('LocalizacaoScreen: Erro recebido do mapa:', error);
    console.error('LocalizacaoScreen: Rastreador atual:', selectedRastreador);
    setMapError(error);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Localizar Dispositivo"/>
      <View style={styles.container}>
        <View style={styles.areaSelect}>
          <SelectRastrador
            selected={selectedRastreador}
            onSelect={handleRastreadorSelect}
          />
        </View>
        <View style={styles.areaMapa}>
          {selectedRastreador ? (
            mapError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Erro ao carregar mapa: {mapError}</Text>
                <Text style={styles.errorText}>Tente selecionar outro rastreador</Text>
              </View>
            ) : (
              <Mapa 
                rastreadorId={selectedRastreador} 
                onError={handleMapError}
              />
            )
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>Selecione um rastreador para ver o mapa.</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    paddingTop: 20,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  areaSelect: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f0f4f8',
  },
  areaMapa: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8',
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3cd',
    padding: 20,
  },
  errorText: {
    color: '#856404',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
});