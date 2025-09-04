# Bloqueador - Sistema de Rastreamento e Bloqueio

Sistema completo de rastreamento e bloqueio de veículos com interface mobile desenvolvida em React Native/Expo e backend Firebase.

## Funcionalidades Principais

- **Bloqueio/Desbloqueio**: Controle remoto de bloqueio de veículos
- **Localização em Tempo Real**: Rastreamento GPS em tempo real
- **Histórico de Localização**: Visualização completa do histórico de movimentação
- **Cadastro de Dispositivos**: Gerenciamento de rastreadores e equipamentos
- **Vincular Dispositivos**: Associação entre rastreadores e equipamentos
- **Lista de Rastreadores**: Visão geral de todos os dispositivos
- **Configurações**: Personalização do sistema

## Tecnologias Utilizadas

- **Frontend**: React Native, Expo, TypeScript
- **Backend**: Firebase (Firestore, Authentication)
- **Mapas**: React Native Maps
- **Ícones**: Expo Vector Icons
- **Navegação**: Expo Router

## Como Começar

1. Instalar dependências

   ```bash
   npm install
   ```

2. Configurar Firebase
   - Copie suas credenciais do Firebase para `app/firebase/firebaseConfig.js`
   - Configure as regras de segurança do Firestore

3. Iniciar o app

   ```bash
   npx expo start
   ```

4. Popular dados de teste (opcional)
   ```bash
   node scripts/popular-historico-teste.js popular
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Estrutura do Projeto

```
Bloqueador/
├── app/                          # Telas principais do app
│   ├── Screens/                 # Todas as telas do sistema
│   │   ├── HistoricoScreen.tsx  # Histórico de localização
│   │   ├── BloqueioScreen.tsx   # Controle de bloqueio
│   │   ├── LocalizacaoScreen.tsx # Localização em tempo real
│   │   └── ...                  # Outras telas
│   ├── firebase/                # Configuração do Firebase
│   └── index.tsx                # Ponto de entrada
├── components/                   # Componentes reutilizáveis
├── scripts/                     # Scripts de utilidade
│   └── popular-historico-teste.js # Popula dados de teste
└── Firmware/                    # Código para dispositivos IoT
```

## Documentação

- [Histórico de Localização](HISTORICO_LOCALIZACAO.md) - Guia completo da funcionalidade
- [Sistema de Comandos](SISTEMA_COMANDS_PENDENTES.md) - Especificações técnicas
- [Teste de Conectividade](TESTE_CONECTIVIDADE.md) - Procedimentos de teste

## Saiba Mais

Para mais informações sobre desenvolvimento com Expo, consulte:

- [Documentação Expo](https://docs.expo.dev/): Fundamentos e guias avançados
- [Tutorial Expo](https://docs.expo.dev/tutorial/introduction/): Tutorial passo a passo

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
