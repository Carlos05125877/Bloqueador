import Button from '@/components/Button';
import Input from '@/components/Input';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
// Update the path below if your firebase config is not in the root 'app' directory
import { auth } from "../app/firebase/firebaseConfig"; // Adjust the path if your firebase config is elsewhere

export default function App() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    
    if (!email || !senha) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      setError('');
      router.push('./Screens/HomeScreen');
    } catch (e: any) {
      let errorMessage = 'Erro ao fazer login';
      if (e.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (e.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado';
      } else if (e.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <View style={styles.innerContainer}>
          <Text style={styles.title} numberOfLines={1}>
            Contourline Rastreio
          </Text>
          <View style={styles.inputBox}>
            <Input
              label="Email"
              inputType="email"
              secureTextEntry={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.inputBox}>
            <Input
              label="Senha"
              inputType="password"
              secureTextEntry={true}
              value={senha}
              onChangeText={setSenha}
            />
          </View>
          {error ? (
            <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
          ) : null}
          <Button onPress={handleLogin} titulo={loading ? "Carregando..." : "Acessar"} />
          <TouchableOpacity onPress={() => router.push('./Screens/CadastrarScreen')}>
            <Text style={styles.registerText} numberOfLines={1}>
              Cadastre-se
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: '#f7f9fc',
    marginTop: 0,
    marginRight: 'auto',
    marginBottom: 0,
    marginLeft: 'auto',
  },
  innerContainer: {
    display: 'flex',
    width: 302,
    height: "100%",
    flexDirection: 'column',
    gap: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: "auto",
  },
  logo: {
    width: 100,
    height: 100,
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  title: {
    height: 44,
    alignSelf: 'stretch',
    flexShrink: 0,
    fontFamily: 'Open Sans',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 43.578,
    color: '#002845',
    position: 'relative',
    textAlign: 'center',
    zIndex: 2,
  },
  inputBox: {
    display: 'flex',
    width: 290,
    height: 55,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#eaeaea',
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 3,
    marginBottom: 0,
  },
  input: {
    height: 54,
    width: '100%',
    paddingHorizontal: 10,
    fontSize: 20,
    fontFamily: 'Open Sans',
    color: '#333',
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  senhaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  showSenhaButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  showSenhaText: {
    color: '#002845',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    display: 'flex',
    width: 302,
    height: 55,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
    position: 'relative',
    zIndex: 11,
  },
  buttonBox: {
    display: 'flex',
    width: 230,
    height: 55,
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
    backgroundColor: '#002845',
    borderRadius: 20,
    position: 'absolute',
    top: -0.5,
    left: 36,
    overflow: 'hidden',
    zIndex: 12,
  },
  buttonContent: {
    display: 'flex',
    paddingTop: 10,
    paddingRight: 24,
    paddingBottom: 10,
    paddingLeft: 24,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    flexWrap: 'nowrap',
    position: 'relative',
    zIndex: 13,
  },
  buttonText: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Roboto',
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  registerText: {
    height: 24,
    alignSelf: 'stretch',
    flexShrink: 0,
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    color: '#002845',
    position: 'relative',
    textAlign: 'center',
    zIndex: 15,
  },
});
