import Header from '@/components/Header';
import { onAuthStateChanged, updateEmail, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

const ConfiguracoesScreen = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('onAuthStateChanged disparado', user);
      if (user) {
        setUserId(user.uid);
        setEmail(user.email || '');
        // Buscar nome no Firestore
        const userRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userRef);
          console.log('userSnap.exists:', userSnap.exists());
          if (userSnap.exists()) {
            const data = userSnap.data();
            setNome(data.nome || '');
          }
        } catch (e) {
          console.log('Erro ao buscar userSnap:', e);
        }
      }
      setLoading(false);
      console.log('setLoading(false) chamado');
    });
    return unsubscribe;
  }, []);

  const handleSalvar = async () => {
    if (!userId) return;
    setSalvando(true);
    try {
      // Atualizar nome no Firestore
      await setDoc(doc(db, 'users', userId), { nome, email }, { merge: true });
      // Atualizar email no auth
      if (auth.currentUser && email !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, email);
      }
      // Atualizar nome no perfil do auth
      if (auth.currentUser && nome !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: nome });
      }
      Alert.alert('Sucesso', 'Dados atualizados com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível atualizar os dados.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title='Configurações do Usuário' />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#002845" />
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.label}>Nome:</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome do usuário"
            />
            <Text style={styles.label}>Email:</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, salvando && { opacity: 0.6 }]}
              onPress={handleSalvar}
              disabled={salvando}
            >
              <Text style={styles.buttonText}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontWeight: 'bold',
    color: '#002845',
    fontSize: 15,
    marginTop: 10,
  },
  value: {
    color: '#333',
    fontSize: 16,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ConfiguracoesScreen;
