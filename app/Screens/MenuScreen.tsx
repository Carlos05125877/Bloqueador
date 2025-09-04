import Header from '@/components/Header';
import SelectFuncao from '@/components/SelectFuncao';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View
} from 'react-native';

const SelectScreen = () => {

  return (
    <SafeAreaView style={styles.container}>
      <Header title='Menu' />
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
            onPress={() => router.push('./VincularScreen')}
          />
        </View>
        <View style={[{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }, styles.functionsContainer]}>
          <SelectFuncao 
            title='Lista de Rastreadores'
            icon={<FontAwesome6 name="list-ul" size={32} color="black" />}
            onPress={() => router.push('./ListaScreen')}
          />
          <SelectFuncao 
            title='Histórico de Localização'
            icon={<Feather name="clock" size={32} color="black" />}
            onPress={() => router.push('./HistoricoScreen')}
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

export default SelectScreen;
