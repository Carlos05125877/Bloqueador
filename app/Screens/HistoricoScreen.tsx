import Header from '@/components/Header';
import SelectRastrador from '@/components/SelectRastrador';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth } from '../firebase/firebaseConfig';
import { FiltroHistorico, historicoService, LocalizacaoHistorico, PaginacaoHistorico } from '../services/HistoricoService';


const HistoricoScreen = () => {
  const [localizacoes, setLocalizacoes] = useState<LocalizacaoHistorico[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rastreadorSelecionado, setRastreadorSelecionado] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [paginacao, setPaginacao] = useState<PaginacaoHistorico | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribe;
  }, []);


  useEffect(() => {
    if (!userId || !rastreadorSelecionado) return;
    carregarHistorico();
  }, [userId, rastreadorSelecionado, dataInicio, dataFim]);


  const carregarHistorico = async () => {
    if (!rastreadorSelecionado || !userId) return;
    
    try {
      setLoading(true);
      setErro(null);
      
      // Preparar filtros
      const filtros: FiltroHistorico = {};
      
      if (dataInicio && dataFim) {
        filtros.dataInicio = new Date(dataInicio + 'T00:00:00');
        filtros.dataFim = new Date(dataFim + 'T23:59:59');
      }
      
      // Buscar histórico usando o serviço otimizado
      const resultado = await historicoService.buscarHistorico(
        userId,
        rastreadorSelecionado,
        filtros
      );
      
      setLocalizacoes(resultado.registros);
      setPaginacao(resultado);
      setFiltroAtivo(!!(dataInicio && dataFim));
      
    } catch (error) {
      setErro('Erro ao carregar histórico.');
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setFiltroAtivo(false);
  };

  const formatarData = (timestamp: any) => {
    if (!timestamp) return 'Data não disponível';
    try {
      const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const formatarCoordenadas = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const abrirNoMapa = (latitude: number, longitude: number) => {
    // Implementar abertura no mapa (Google Maps, Apple Maps, etc.)
    Alert.alert('Abrir no Mapa', 'Funcionalidade em desenvolvimento');
  };

  const renderizarItemHistorico = ({ item }: { item: LocalizacaoHistorico }) => (
    <View style={styles.itemHistorico}>
      <View style={styles.headerItem}>
        <Text style={styles.timestamp}>{formatarData(item.timestamp)}</Text>
        <TouchableOpacity 
          style={styles.botaoMapa}
          onPress={() => abrirNoMapa(item.latitude, item.longitude)}
        >
          <MaterialIcons name="map" size={20} color="#007bff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.coordenadasContainer}>
        <Text style={styles.label}>Coordenadas:</Text>
        <Text style={styles.coordenadas}>
          {formatarCoordenadas(item.latitude, item.longitude)}
        </Text>
      </View>
      
      {item.endereco && (
        <View style={styles.infoContainer}>
          <Text style={styles.label}>Endereço:</Text>
          <Text style={styles.value}>{item.endereco}</Text>
        </View>
      )}
      
      <View style={styles.metricasContainer}>
        {item.velocidade !== undefined && (
          <View style={styles.metrica}>
            <MaterialIcons name="speed" size={16} color="#666" />
            <Text style={styles.metricaTexto}>{item.velocidade} km/h</Text>
          </View>
        )}
        
        {item.bateria !== undefined && (
          <View style={styles.metrica}>
            <MaterialIcons name="battery-full" size={16} color="#666" />
            <Text style={styles.metricaTexto}>{item.bateria}%</Text>
          </View>
        )}
        
        {item.sinal !== undefined && (
          <View style={styles.metrica}>
            <MaterialIcons name="signal-cellular-4-bar" size={16} color="#666" />
            <Text style={styles.metricaTexto}>{item.sinal}%</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title='Histórico de Localização' />
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Seletor de Rastreador */}
        <View style={styles.seletorContainer}>
          <SelectRastrador
            selected={rastreadorSelecionado}
            onSelect={setRastreadorSelecionado}
          />
        </View>

        {/* Filtros de Data */}
        <View style={styles.filtrosContainer}>
          <Text style={styles.label}>Filtrar por Período:</Text>
          <View style={styles.dataInputsContainer}>
            <View style={styles.dataInput}>
              <Text style={styles.dataLabel}>Data Início:</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                value={dataInicio}
                onChangeText={setDataInicio}
              />
            </View>
            <View style={styles.dataInput}>
              <Text style={styles.dataLabel}>Data Fim:</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                value={dataFim}
                onChangeText={setDataFim}
              />
            </View>
          </View>
          
          <View style={styles.botoesFiltro}>
            <TouchableOpacity 
              style={styles.botaoFiltro}
              onPress={carregarHistorico}
            >
              <Text style={styles.botaoFiltroTexto}>Aplicar Filtro</Text>
            </TouchableOpacity>
            
            {filtroAtivo && (
              <TouchableOpacity 
                style={[styles.botaoFiltro, styles.botaoLimpar]}
                onPress={limparFiltros}
              >
                <Text style={styles.botaoLimparTexto}>Limpar Filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>


        {/* Lista de Histórico */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#002845" />
            <Text style={styles.loadingText}>Carregando histórico...</Text>
          </View>
        ) : erro ? (
          <View style={styles.erroContainer}>
            <FontAwesome6 name="exclamation-triangle" size={24} color="#dc3545" />
            <Text style={styles.erroTexto}>{erro}</Text>
          </View>
        ) : localizacoes.length === 0 ? (
          <View style={styles.vazioContainer}>
            <MaterialIcons name="location-off" size={48} color="#ccc" />
            <Text style={styles.vazioTexto}>
              {rastreadorSelecionado ? 
                'Nenhum histórico encontrado para este rastreador.' : 
                'Selecione um rastreador para visualizar o histórico.'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.listaContainer}>
            <Text style={styles.label}>Histórico de Localizações:</Text>
            <FlatList
              data={localizacoes}
              keyExtractor={(item) => item.id}
              renderItem={renderizarItemHistorico}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

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
  content: {
    flex: 1,
    padding: 16,
  },
  seletorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#002845',
    marginBottom: 12,
  },
  filtrosContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dataInputsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dataInput: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
  },
  botoesFiltro: {
    flexDirection: 'row',
    gap: 12,
  },
  botaoFiltro: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  botaoFiltroTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  botaoLimpar: {
    backgroundColor: '#6c757d',
  },
  botaoLimparTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  erroContainer: {
    alignItems: 'center',
    padding: 32,
  },
  erroTexto: {
    marginTop: 12,
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  vazioContainer: {
    alignItems: 'center',
    padding: 32,
  },
  vazioTexto: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listaContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemHistorico: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  headerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#002845',
  },
  botaoMapa: {
    padding: 8,
  },
  coordenadasContainer: {
    marginBottom: 12,
  },
  coordenadas: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#e9ecef',
    padding: 8,
    borderRadius: 4,
  },
  infoContainer: {
    marginBottom: 12,
  },
  value: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  metricasContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  metrica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricaTexto: {
    fontSize: 12,
    color: '#666',
  },
});

export default HistoricoScreen;
