import Header from '@/components/Header';
import SelectFuncao from '@/components/SelectFuncao';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View
} from 'react-native';

const HomeScreen = () => {

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <View style={styles.container}>
        <View style={[{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }, styles.functionsContainer]}>
          <SelectFuncao 
            title='Bloqueio/Desbloqueio'
            icon={<Feather name="lock" size={32} color="black" />}
            onPress={() => router.push('./BloqueioScreen')}
          />
          <SelectFuncao 
            title='Localizar Dispositivo'
            icon={<MaterialIcons name="location-searching" size={32} color="black" />}
            onPress={() => router.push('./LocalizacaoScreen')}
          />
        </View>
        <View style={[{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }, styles.functionsContainer]}>
          <SelectFuncao 
            title='Cadastrar Dispositivo'
            icon={<Ionicons name="add-circle-outline" size={32} color="black" />}
            onPress={() => router.push('./CadastrarRastradorScreen')}
          />
          <SelectFuncao 
            title='Vincular Dispositivo'
            icon={<Feather name="map-pin" size={32} color="black" />}
          />
        </View>
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
  functionsContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 20,
    gap: 20
  }
});

export default HomeScreen;
