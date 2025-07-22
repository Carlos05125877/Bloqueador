import Header from '@/components/Header';
import { useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
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

interface Rastreador {
  numeroRastreador: string;
  equipamentoVinculado?: Equipamento;
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24,  }}>
              <Button
                title="Editar"
                color="#007bff"
                onPress={() => Alert.alert('Em breve', 'Funcionalidade de edição em breve!')}
              />
              <Button
                title="Excluir"
                color="#dc3545"
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
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const ListaScreen = () => {
  const [rastreadores, setRastreadores] = useState<Rastreador[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [modelos, setModelos] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setErro(null);
    getDocs(collection(db, 'users', userId, 'rastradores'))
      .then(snapshot => {
        const lista: Rastreador[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            numeroRastreador: data.numeroRastreador || doc.id,
            equipamentoVinculado: data.equipamentoVinculado,
            ...data
          };
        });
        setRastreadores(lista);
        // Extrair modelos e meses únicos para os filtros
        const modelosUnicos = Array.from(new Set(lista.map(r => r.equipamentoVinculado?.modeloEquipamento).filter((v): v is string => !!v)));
        setModelos(modelosUnicos);
        const mesesUnicos = Array.from(new Set(lista.map(r => {
          const data = r.equipamentoVinculado?.dataInstalacao;
          if (data && data.length === 10) return data.slice(3, 10); // MM/AAAA
          return undefined;
        }).filter((v): v is string => !!v)));
        setMeses(mesesUnicos);
      })
      .catch(() => setErro('Erro ao buscar rastreadores.'))
      .finally(() => setLoading(false));
  }, [userId]);

  // Filtro e busca
  const rastreadoresFiltrados = rastreadores.filter(r => {
    const eq = r.equipamentoVinculado;
    const busca = search.trim().toLowerCase();
    const passaBusca = !busca ||
      (r.numeroRastreador && r.numeroRastreador.toLowerCase().includes(busca)) ||
      (eq && eq.numeroSerie && eq.numeroSerie.toLowerCase().includes(busca));
    const passaModelo = !filtroModelo || (eq && eq.modeloEquipamento === filtroModelo);
    const passaMes = !filtroMes || (eq && eq.dataInstalacao && eq.dataInstalacao.slice(3, 10) === filtroMes);
    return passaBusca && passaModelo && passaMes;
  });

  // Função para exportar para PDF
  const exportarParaPDF = async () => {
    if (rastreadoresFiltrados.length === 0) {
      Alert.alert('Atenção', 'Nenhum rastreador para exportar.');
      return;
    }
    // Montar HTML da tabela
    const html = `
      <h2>Lista de Rastreadores</h2>
      <table border="1" cellspacing="0" cellpadding="4" style="width:100%; font-size:12px; border-collapse:collapse;">
        <thead>
          <tr>
            <th>Rastreador</th>
            <th>Modelo</th>
            <th>Nº Série</th>
            <th>Data Instalação</th>
            <th>Técnico</th>
            <th>Pedido/OP</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rastreadoresFiltrados.map(item => {
            const eq: Equipamento = item.equipamentoVinculado || {} as Equipamento;
            return `<tr>
              <td>${item.numeroRastreador || '-'}</td>
              <td>${eq.modeloEquipamento || '-'}</td>
              <td>${eq.numeroSerie || '-'}</td>
              <td>${eq.dataInstalacao || '-'}</td>
              <td>${eq.tecnico || '-'}</td>
              <td>${eq.numeroPedido || '-'}</td>
              <td>${eq.bloqueado === undefined ? 'Desconhecido' : eq.bloqueado ? 'Bloqueado' : 'Desbloqueado'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    try {
      const options = {
        html,
        fileName: `rastreadores_${Date.now()}`,
        directory: 'Download',
      };
      const file = await RNHTMLtoPDF.convert(options);
      if (file.filePath) {
        await Share.open({
          title: 'Lista de rastreadores',
          url: 'file://' + file.filePath,
          type: 'application/pdf',
          message: 'Lista de rastreadores exportada.'
        });
      } else {
        Alert.alert('Erro', 'Não foi possível gerar o PDF.');
      }
    } catch (e: any) {
      console.log('Erro ao exportar PDF:', e);
      Alert.alert('Erro', 'Falha ao exportar para PDF. ' + (e?.message || ''));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title='Lista de Rastreadores' />
      <View style={{ alignItems: 'flex-end', width: '100%', paddingHorizontal: 12, marginTop: 8 }}>
        <TouchableOpacity onPress={exportarParaPDF} style={{ backgroundColor: '#007bff', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Exportar para PDF</Text>
        </TouchableOpacity>
      </View>
      <View style={{ padding: 12, width: '100%' }}>
        <TextInput
          style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ccc' }}
          placeholder="Buscar por número de série ou rastreador"
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TextInput
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#ccc' }}
            placeholder="Filtrar por modelo"
            value={filtroModelo}
            onChangeText={setFiltroModelo}
          />
          <TextInput
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#ccc' }}
            placeholder="Filtrar por mês (MM/AAAA)"
            value={filtroMes}
            onChangeText={setFiltroMes}
          />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#002845" />
      ) : erro ? (
        <Text style={{ color: 'red', textAlign: 'center' }}>{erro}</Text>
      ) : (
        <FlatList
          data={rastreadoresFiltrados}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24 }}>Nenhum rastreador encontrado.</Text>}
          renderItem={({ item }) => {
            const eq = item.equipamentoVinculado;
            return (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, margin: 8, padding: 12, elevation: 2 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Rastreador: {item.numeroRastreador}</Text>
                <Text>Modelo: {eq?.modeloEquipamento || '-'}</Text>
                <Text>Número de Série: {eq?.numeroSerie || '-'}</Text>
                <Text>Data de Instalação: {eq?.dataInstalacao || '-'}</Text>
                <Text>Técnico: {eq?.tecnico || '-'}</Text>
                <Text>Pedido/OP: {eq?.numeroPedido || '-'}</Text>
                <Text>Status: {eq?.bloqueado === undefined ? 'Desconhecido' : eq?.bloqueado ? 'Bloqueado' : 'Desbloqueado'}</Text>
              </View>
            );
          }}
        />
      )}
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
});

export default ListaScreen;
