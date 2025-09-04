import {
    DocumentData,
    QueryDocumentSnapshot,
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export interface LocalizacaoHistorico {
  id: string;
  rastreadorId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  endereco?: string;
  velocidade?: number;
  bateria?: number;
  sinal?: number;
  status?: string;
  createdAt: Date;
}

export interface FiltroHistorico {
  dataInicio?: Date;
  dataFim?: Date;
  rastreadorId?: string;
  velocidadeMin?: number;
  velocidadeMax?: number;
  bateriaMin?: number;
  sinalMin?: number;
}


export interface PaginacaoHistorico {
  registros: LocalizacaoHistorico[];
  hasMore: boolean;
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  totalProcessados: number;
}

class HistoricoService {
  private readonly BATCH_SIZE = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  /**
   * Busca histórico de localizações com paginação
   */
  public async buscarHistorico(
    userId: string,
    rastreadorId: string,
    filtros: FiltroHistorico = {},
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<PaginacaoHistorico> {
    try {
      const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
      
      let q = query(
        historicoRef,
        orderBy('timestamp', 'desc'),
        limit(this.BATCH_SIZE)
      );

      // Aplicar filtros
      if (filtros.dataInicio) {
        q = query(q, where('timestamp', '>=', filtros.dataInicio));
      }
      
      if (filtros.dataFim) {
        q = query(q, where('timestamp', '<=', filtros.dataFim));
      }

      if (filtros.velocidadeMin !== undefined) {
        q = query(q, where('velocidade', '>=', filtros.velocidadeMin));
      }

      if (filtros.velocidadeMax !== undefined) {
        q = query(q, where('velocidade', '<=', filtros.velocidadeMax));
      }

      if (filtros.bateriaMin !== undefined) {
        q = query(q, where('bateria', '>=', filtros.bateriaMin));
      }

      if (filtros.sinalMin !== undefined) {
        q = query(q, where('sinal', '>=', filtros.sinalMin));
      }

      // Aplicar paginação
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      
      const registros: LocalizacaoHistorico[] = snapshot.docs.map(doc => ({
        id: doc.id,
        rastreadorId,
        ...doc.data()
      } as LocalizacaoHistorico));

      return {
        registros,
        hasMore: snapshot.docs.length === this.BATCH_SIZE,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        totalProcessados: registros.length
      };

    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error);
      throw new Error('Falha ao carregar histórico de localizações');
    }
  }

  /**
   * Busca histórico completo (sem paginação) para exportação
   */
  public async buscarHistoricoCompleto(
    userId: string,
    rastreadorId: string,
    filtros: FiltroHistorico = {}
  ): Promise<LocalizacaoHistorico[]> {
    try {
      const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
      
      let q = query(historicoRef, orderBy('timestamp', 'desc'));

      // Aplicar filtros básicos
      if (filtros.dataInicio) {
        q = query(q, where('timestamp', '>=', filtros.dataInicio));
      }
      
      if (filtros.dataFim) {
        q = query(q, where('timestamp', '<=', filtros.dataFim));
      }

      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        rastreadorId,
        ...doc.data()
      } as LocalizacaoHistorico));

    } catch (error) {
      console.error('❌ Erro ao buscar histórico completo:', error);
      throw new Error('Falha ao carregar histórico completo');
    }
  }


  /**
   * Adiciona nova entrada no histórico
   */
  public async adicionarEntrada(
    userId: string,
    rastreadorId: string,
    dados: Omit<LocalizacaoHistorico, 'id' | 'rastreadorId' | 'createdAt'>
  ): Promise<string> {
    try {
      const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
      
      const docRef = await addDoc(historicoRef, {
        ...dados,
        createdAt: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('❌ Erro ao adicionar entrada no histórico:', error);
      throw new Error('Falha ao salvar entrada no histórico');
    }
  }

  /**
   * Atualiza entrada existente no histórico
   */
  public async atualizarEntrada(
    userId: string,
    rastreadorId: string,
    entradaId: string,
    dados: Partial<LocalizacaoHistorico>
  ): Promise<void> {
    try {
      const entradaRef = doc(db, 'users', userId, 'rastradores', rastreadorId, 'historico', entradaId);
      
      await updateDoc(entradaRef, {
        ...dados,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar entrada no histórico:', error);
      throw new Error('Falha ao atualizar entrada no histórico');
    }
  }

  /**
   * Remove entrada do histórico
   */
  public async removerEntrada(
    userId: string,
    rastreadorId: string,
    entradaId: string
  ): Promise<void> {
    try {
      const entradaRef = doc(db, 'users', userId, 'rastradores', rastreadorId, 'historico', entradaId);
      
      await deleteDoc(entradaRef);
    } catch (error) {
      console.error('❌ Erro ao remover entrada do histórico:', error);
      throw new Error('Falha ao remover entrada do histórico');
    }
  }

  /**
   * Limpa histórico antigo (manutenção)
   */
  public async limparHistoricoAntigo(
    userId: string,
    rastreadorId: string,
    diasParaManter: number = 90
  ): Promise<number> {
    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasParaManter);

      const historico = await this.buscarHistoricoCompleto(userId, rastreadorId);
      const registrosParaRemover = historico.filter(r => {
        const data = r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
        return data < dataLimite;
      });

      if (registrosParaRemover.length === 0) {
        return 0;
      }

      // Remover em lotes para evitar timeout
      const batch = writeBatch(db);
      let removidos = 0;

      for (const registro of registrosParaRemover) {
        const entradaRef = doc(db, 'users', userId, 'rastradores', rastreadorId, 'historico', registro.id);
        batch.delete(entradaRef);
        removidos++;

        // Commit a cada 500 operações
        if (removidos % 500 === 0) {
          await batch.commit();
        }
      }

      // Commit final
      if (removidos % 500 !== 0) {
        await batch.commit();
      }

      return removidos;
    } catch (error) {
      console.error('❌ Erro ao limpar histórico antigo:', error);
      throw new Error('Falha ao limpar histórico antigo');
    }
  }

  /**
   * Busca última localização conhecida
   */
  public async buscarUltimaLocalizacao(
    userId: string,
    rastreadorId: string
  ): Promise<LocalizacaoHistorico | null> {
    try {
      const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
      const q = query(historicoRef, orderBy('timestamp', 'desc'), limit(1));
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        rastreadorId,
        ...doc.data()
      } as LocalizacaoHistorico;

    } catch (error) {
      console.error('❌ Erro ao buscar última localização:', error);
      throw new Error('Falha ao buscar última localização');
    }
  }

  /**
   * Busca localizações por período específico
   */
  public async buscarPorPeriodo(
    userId: string,
    rastreadorId: string,
    dataInicio: Date,
    dataFim: Date
  ): Promise<LocalizacaoHistorico[]> {
    try {
      const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
      const q = query(
        historicoRef,
        where('timestamp', '>=', dataInicio),
        where('timestamp', '<=', dataFim),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        rastreadorId,
        ...doc.data()
      } as LocalizacaoHistorico));

    } catch (error) {
      console.error('❌ Erro ao buscar por período:', error);
      throw new Error('Falha ao buscar localizações por período');
    }
  }

  /**
   * Exporta histórico para formato CSV
   */
  public async exportarCSV(
    userId: string,
    rastreadorId: string,
    filtros: FiltroHistorico = {}
  ): Promise<string> {
    try {
      const historico = await this.buscarHistoricoCompleto(userId, rastreadorId, filtros);
      
      if (historico.length === 0) {
        return '';
      }

      // Cabeçalho CSV
      const headers = [
        'Data/Hora',
        'Latitude',
        'Longitude',
        'Velocidade (km/h)',
        'Bateria (%)',
        'Sinal (%)',
        'Status',
        'Endereço'
      ].join(',');

      // Dados CSV
      const rows = historico.map(registro => {
        const data = registro.timestamp.toDate ? 
          registro.timestamp.toDate() : 
          new Date(registro.timestamp);
        
        return [
          data.toISOString(),
          registro.latitude,
          registro.longitude,
          registro.velocidade || '',
          registro.bateria || '',
          registro.sinal || '',
          registro.status || '',
          `"${registro.endereco || ''}"`
        ].join(',');
      });

      return [headers, ...rows].join('\n');

    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error);
      throw new Error('Falha ao exportar histórico para CSV');
    }
  }
}

export const historicoService = new HistoricoService();
export default HistoricoService;

