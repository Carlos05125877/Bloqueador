import Header from '@/components/Header';
import { useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

interface Equipamento {
  modeloEquipamento: string;
  rastreadorVinculado: string;
  numeroSerie: string;
  numeroPedido: string;
  dataInstalacao: string;
  tecnico: string;
  createdAt: string;
  bloqueado?: boolean;
  [key: string]: any;
}

const DetalhesScreen = ({ route }: any) => {
  const [equipamento, setEquipamento] = useState<Equipamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null); // Novo estado para erro

  // Recebe o número de série via query param
  const { numeroSerie } = useLocalSearchParams();

  useEffect(() => {
    console.log('numeroSerie recebido:', numeroSerie);
    if (!numeroSerie) {
      setErro('Nenhum número de série foi informado para exibir os detalhes.');
      setLoading(false);
    }
  }, [numeroSerie]);

  useEffect(() => {
    console.log('userId:', userId);
  }, [userId]);

  useEffect(() => {
    if (!numeroSerie) return; // Não buscar se não houver numeroSerie
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribe;
  }, [numeroSerie]);

  useEffect(() => {
    if (!numeroSerie) return; // Não buscar se não houver numeroSerie
    const fetchEquipamento = async () => {
      if (!userId || !numeroSerie) {
        console.log('Faltando userId ou numeroSerie');
        setErro('Usuário não autenticado ou número de série não informado.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setErro(null);
      try {
        // Buscar em todos os rastreadores para encontrar o equipamento
        const rastreadoresRef = collection(db, 'users', userId, 'rastradores');
        const rastreadoresSnap = await getDocs(rastreadoresRef);
        
        let equipamentoEncontrado = null;
        
        for (const docSnap of rastreadoresSnap.docs) {
          const data = docSnap.data();
          if (data.equipamentoVinculado && data.equipamentoVinculado.numeroSerie === numeroSerie) {
            equipamentoEncontrado = {
              ...data.equipamentoVinculado,
              rastreadorVinculado: data.numeroRastreador
            };
            break;
          }
        }
        
        if (equipamentoEncontrado) {
          setEquipamento(equipamentoEncontrado as Equipamento);
        } else {
          setErro('Equipamento não encontrado.');
          setEquipamento(null);
          console.log('Equipamento não encontrado');
        }
      } catch (error) {
        setErro('Erro ao buscar equipamento.');
        setEquipamento(null);
        console.error('Erro ao buscar equipamento:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEquipamento();
  }, [userId, numeroSerie]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title='Detalhes do Equipamento' />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#002845" />
        ) : erro ? (
          <Text style={[styles.value, { color: '#dc3545', textAlign: 'center' }]}>{erro}</Text>
        ) : equipamento ? (
          <View style={styles.infoBox}>
            <Text style={styles.label}>Modelo do Equipamento:</Text>
            <Text style={styles.value}>{equipamento.modeloEquipamento}</Text>
            <Text style={styles.label}>Número do Rastreador:</Text>
            <Text style={styles.value}>{equipamento.rastreadorVinculado}</Text>
            <Text style={styles.label}>Número de Série:</Text>
            <Text style={styles.value}>{equipamento.numeroSerie}</Text>
            <Text style={styles.label}>Pedido de Venda / Ordem de Produção:</Text>
            <Text style={styles.value}>{equipamento.numeroPedido}</Text>
            <Text style={styles.label}>Data de Instalação:</Text>
            <Text style={styles.value}>{equipamento.dataInstalacao}</Text>
            <Text style={styles.label}>Técnico Instalador:</Text>
            <Text style={styles.value}>{equipamento.tecnico}</Text>
            <Text style={styles.label}>Status de Bloqueio:</Text>
            <Text style={[styles.value, { color: equipamento.bloqueado ? '#dc3545' : '#28a745', fontWeight: 'bold' }]}>
              {equipamento.bloqueado === undefined ? 'Desconhecido' : equipamento.bloqueado ? 'Bloqueado' : 'Desbloqueado'}
            </Text>
            {/* Exibir outros campos se existirem */}
            {Object.entries(equipamento).map(([key, value]) => (
              !['modeloEquipamento','rastreadorVinculado','numeroSerie','numeroPedido','dataInstalacao','tecnico','createdAt','bloqueado'].includes(key) && (
                <View key={key} style={{ marginTop: 8 }}>
                  <Text style={styles.label}>{key}:</Text>
                  <Text style={styles.value}>{String(value)}</Text>
                </View>
              )
            ))}
            {/* Botões de ação */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 16 }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#007bff' }]}
                onPress={() => Alert.alert('Em breve', 'Funcionalidade de edição em breve!')}
              >
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#dc3545' }]}
                onPress={async () => {
                  try {
                    if (!userId || !equipamento.rastreadorVinculado) {
                      Alert.alert('Erro', 'Não foi possível identificar o rastreador para exclusão.');
                      return;
                    }
                    await deleteDoc(doc(db, 'users', userId, 'rastradores', equipamento.rastreadorVinculado));
                    Alert.alert('Sucesso', 'Rastreador excluído com sucesso!');
                  } catch (e) {
                    Alert.alert('Erro', 'Não foi possível excluir o rastreador.');
                  }
                }}
              >
                <Text style={styles.buttonText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
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
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DetalhesScreen;
