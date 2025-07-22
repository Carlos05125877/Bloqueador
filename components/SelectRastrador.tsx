import Feather from '@expo/vector-icons/Feather';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from "../app/firebase/firebaseConfig";

interface SelectRastradorProps {
  selected: string;
  onSelect: (numero: string) => void;
}

export default function SelectRastrador({ selected, onSelect }: SelectRastradorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [rastreadorList, setRastreadorList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('Buscando rastreadores para usuário:', user.uid);
        const snap = await getDocs(collection(db, 'users', user.uid, 'rastradores'));
        const lista = snap.docs.map(doc => doc.data().numeroRastreador);
        console.log('Rastreadores encontrados:', lista);
        setRastreadorList(lista);
      } else {
        console.log('Usuário não autenticado');
        setRastreadorList([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Filtra os rastreadores conforme o texto digitado
  const filtered = rastreadorList.filter(item =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <ActivityIndicator />;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Selecione o rastreador:</Text>
      <TouchableOpacity
        style={styles.selectedBox}
        onPress={() => {
          if (rastreadorList.length === 0) {
            console.log('Nenhum rastreador disponível para seleção');
            return;
          }
          setModalVisible(true);
        }}
      >
        <Text style={styles.selectedText}>
          {selected ? selected : rastreadorList.length === 0 ? 'Nenhum rastreador disponível' : 'Escolha um rastreador'}
        </Text>
      </TouchableOpacity>
      
      {rastreadorList.length === 0 && !loading && (
        <Text style={styles.noRastreadoresText}>
          Nenhum rastreador cadastrado. Cadastre um rastreador primeiro.
        </Text>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setModalVisible(false)} activeOpacity={1}>
          <View style={styles.modalContent}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={20} color="#002845" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Pesquisar rastreador"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor="#888"
              />
            </View>
            
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.item,
                    selected === item && styles.selectedItem
                  ]}
                  onPress={() => {
                    console.log('Rastreador selecionado:', item);
                    onSelect(item);
                    setModalVisible(false);
                    setSearch('');
                  }}
                >
                  <Text style={[styles.itemText, selected === item && styles.selectedItemText]}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: '#888', textAlign: 'center', marginTop: 16 }}>
                  {search ? 'Nenhum rastreador encontrado' : 'Nenhum rastreador disponível'}
                </Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    padding: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#002845',
    textAlign: 'center',
    width: '100%',
  },
  selectedBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#eaeaea',
    marginBottom: 8,

  },
  selectedText: {
    textAlign: 'center',
    color: '#002845',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 250,
    maxHeight: 350,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaeaea',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 16,
    color: '#002845',
  },
  item: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#eaeaea',
    marginBottom: 8,
  },
  selectedItem: {
    backgroundColor: '#0056b3', // azul mais claro
  },
  itemText: {
    color: '#002845',
    fontSize: 16,
  },
  selectedItemText: {
    color: '#fff', // texto branco para o selecionado
    fontSize: 16,
    fontWeight: 'bold',
  },
  noRastreadoresText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
});
