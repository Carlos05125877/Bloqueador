// Script para popular o Firebase com dados de teste para histórico de localização
// Execute este script no Node.js para criar dados de exemplo

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Configuração do Firebase (substitua pelos seus dados)
const firebaseConfig = {
  apiKey: "AIzaSyBTwQ9OrAn4tsOwjv_btKzgh0oS0_myUZY",
  authDomain: "contourlinerastreador.firebaseapp.com",
  projectId: "contourlinerastreador",
  storageBucket: "contourlinerastreador.appspot.com",
  messagingSenderId: "571468560950",
  appId: "1:571468560950:web:260e2c44bf7932c7e4b697",
  measurementId: "G-DD8RQTP233"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dados de exemplo para diferentes cenários
const cenariosLocalizacao = [
  {
    nome: "Veículo em movimento pela cidade",
    coordenadas: [
      { lat: -23.550520, lng: -46.633308, endereco: "Av. Paulista, 1000, São Paulo - SP" },
      { lat: -23.551234, lng: -46.634567, endereco: "Av. Paulista, 1200, São Paulo - SP" },
      { lat: -23.552345, lng: -46.635678, endereco: "Av. Paulista, 1400, São Paulo - SP" },
      { lat: -23.553456, lng: -46.636789, endereco: "Av. Paulista, 1600, São Paulo - SP" },
      { lat: -23.554567, lng: -46.637890, endereco: "Av. Paulista, 1800, São Paulo - SP" }
    ],
    velocidade: [45, 52, 38, 61, 47],
    bateria: [85, 84, 83, 82, 81],
    sinal: [92, 91, 93, 90, 89]
  },
  {
    nome: "Veículo parado em estacionamento",
    coordenadas: [
      { lat: -23.560000, lng: -46.650000, endereco: "Shopping Morumbi, São Paulo - SP" },
      { lat: -23.560000, lng: -46.650000, endereco: "Shopping Morumbi, São Paulo - SP" },
      { lat: -23.560000, lng: -46.650000, endereco: "Shopping Morumbi, São Paulo - SP" },
      { lat: -23.560000, lng: -46.650000, endereco: "Shopping Morumbi, São Paulo - SP" }
    ],
    velocidade: [0, 0, 0, 0],
    bateria: [80, 79, 78, 77],
    sinal: [88, 87, 86, 85]
  },
  {
    nome: "Veículo em rodovia",
    coordenadas: [
      { lat: -23.500000, lng: -46.700000, endereco: "Rodovia dos Imigrantes, km 25" },
      { lat: -23.480000, lng: -46.720000, endereco: "Rodovia dos Imigrantes, km 30" },
      { lat: -23.460000, lng: -46.740000, endereco: "Rodovia dos Imigrantes, km 35" },
      { lat: -23.440000, lng: -46.760000, endereco: "Rodovia dos Imigrantes, km 40" }
    ],
    velocidade: [95, 98, 102, 97],
    bateria: [75, 74, 73, 72],
    sinal: [95, 94, 96, 93]
  }
];

// Função para gerar timestamp aleatório nas últimas 24 horas
function gerarTimestampAleatorio() {
  const agora = new Date();
  const vinteQuatroHorasAtras = new Date(agora.getTime() - (24 * 60 * 60 * 1000));
  const tempoAleatorio = Math.random() * (agora.getTime() - vinteQuatroHorasAtras.getTime());
  return new Date(vinteQuatroHorasAtras.getTime() + tempoAleatorio);
}

// Função para popular histórico de um rastreador
async function popularHistoricoRastreador(userId, rastreadorId, cenarios) {
  console.log(`\n🔄 Populando histórico para rastreador: ${rastreadorId}`);
  
  const historicoRef = collection(db, 'users', userId, 'rastradores', rastreadorId, 'historico');
  
  for (const cenario of cenarios) {
    console.log(`  📍 Criando cenário: ${cenario.nome}`);
    
    for (let i = 0; i < cenario.coordenadas.length; i++) {
      const coord = cenario.coordenadas[i];
      const timestamp = gerarTimestampAleatorio();
      
      const localizacao = {
        numeroRastreador: rastreadorId,
        latitude: coord.lat,
        longitude: coord.lng,
        timestamp: timestamp,
        endereco: coord.endereco,
        velocidade: cenario.velocidade[i],
        bateria: cenario.bateria[i],
        sinal: cenario.sinal[i]
      };
      
      try {
        await addDoc(historicoRef, localizacao);
        console.log(`    ✅ Localização ${i + 1} criada: ${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`);
      } catch (error) {
        console.error(`    ❌ Erro ao criar localização ${i + 1}:`, error.message);
      }
      
      // Pequena pausa para não sobrecarregar o Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ Histórico populado para rastreador: ${rastreadorId}`);
}

// Função principal para popular dados de teste
async function popularDadosTeste() {
  try {
    console.log('🚀 Iniciando população de dados de teste para histórico de localização...\n');
    
    // IDs de exemplo (substitua pelos IDs reais dos seus usuários e rastreadores)
    const usuariosTeste = [
      {
        userId: 'usuario_teste_1',
        rastreadores: [
          { id: 'RAST001', nome: 'Rastreador Principal' },
          { id: 'RAST002', nome: 'Rastreador Secundário' }
        ]
      }
    ];
    
    for (const usuario of usuariosTeste) {
      console.log(`👤 Usuário: ${usuario.userId}`);
      
      for (const rastreador of usuario.rastreadores) {
        await popularHistoricoRastreador(usuario.userId, rastreador.id, cenariosLocalizacao);
      }
    }
    
    console.log('\n🎉 População de dados de teste concluída com sucesso!');
    console.log('\n📱 Agora você pode testar a tela de histórico no app:');
    console.log('   1. Faça login com o usuário de teste');
    console.log('   2. Acesse a tela de Histórico de Localização');
    console.log('   3. Selecione um rastreador para ver o histórico');
    console.log('   4. Use os filtros de data para testar as funcionalidades');
    
  } catch (error) {
    console.error('❌ Erro durante a população de dados:', error);
  }
}

// Função para limpar dados de teste (opcional)
async function limparDadosTeste() {
  console.log('🧹 Função de limpeza não implementada por segurança');
  console.log('   Para limpar dados, use o console do Firebase ou implemente manualmente');
}

// Executar o script
if (require.main === module) {
  const comando = process.argv[2];
  
  switch (comando) {
    case 'popular':
      popularDadosTeste();
      break;
    case 'limpar':
      limparDadosTeste();
      break;
    default:
      console.log('📖 Uso: node popular-historico-teste.js [comando]');
      console.log('   Comandos disponíveis:');
      console.log('     popular - Popula dados de teste');
      console.log('     limpar  - Limpa dados de teste (não implementado)');
      console.log('\n   Exemplo: node popular-historico-teste.js popular');
  }
}

module.exports = {
  popularDadosTeste,
  limparDadosTeste
};

