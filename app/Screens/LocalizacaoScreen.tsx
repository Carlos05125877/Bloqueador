
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

  const handleRastreadorSelect = (numero: string) => {
    console.log('Rastreador selecionado na LocalizacaoScreen:', numero);
    setSelectedRastreador(numero);
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
            <Mapa rastreadorId={selectedRastreador} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#888' }}>Selecione um rastreador para ver o mapa.</Text>
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
});