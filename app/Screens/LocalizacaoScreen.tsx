
import Header from '@/components/Header';
import Mapa from '@/components/mapa';
import SelectRastrador from '@/components/SelectRastrador';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View
} from 'react-native';

export default function LocalizacaoScreen() {
  const [selectedRastreador, setSelectedRastreador] = useState<string>('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Localizar Dispositivo"/>
      <View style={styles.container}>
        <View style={styles.areaSelect}>
          <SelectRastrador
            selected={selectedRastreador}
            onSelect={setSelectedRastreador}
          />
        </View>
        <View style={styles.areaMapa}>
          <Mapa rastreadorId={selectedRastreador} />
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
    flexDirection: 'column',
  },
  areaMapa: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaSelect: {
    marginTop: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});