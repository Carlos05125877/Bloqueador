import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import * as React from "react";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { auth, db } from "../firebase/firebaseConfig";

const CadastroScreen: React.FC = () => {
    const router = useRouter();
    const [nome, setNome] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const handleRegister = async (): Promise<void> => {
        if (!nome || !email || !password || !confirmPassword) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Erro', 'As senhas não coincidem');
            return;
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            

            await setDoc(doc(db, "users", user.uid), {
                nome: nome,
                email: user.email,
                uid: user.uid,
                createdAt: new Date().toISOString(),
            });
            console.log("Usuário salvo no Firestore");

            setLoading(false);
            router.replace('/Screens/HomeScreen');
            
        } catch (error: any) {
            
            let errorMessage = 'Não foi possível criar a conta';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Este email já está em uso';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'A senha deve ter pelo menos 6 caracteres';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email inválido';
            }
            Alert.alert('Erro de cadastro', errorMessage);
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Header title="REALIZAR CADASTRO"/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                <View style={styles.content}>
                    <View style={styles.inputContainer}>
                        <Input
                            label="Nome"
                            inputType="nome"
                            secureTextEntry={false}
                            value={nome}
                            onChangeText={setNome}
                        />
                        <Input
                            label="Email"
                            inputType="email"
                            secureTextEntry={false}
                            value={email}
                            onChangeText={setEmail}
                        />
                        <Input
                            label="Senha"
                            inputType="password"
                            secureTextEntry={true}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <Input
                            label="Confirmar Senha"
                            inputType="password"
                            secureTextEntry={true}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                    </View>
                    <Button onPress={handleRegister} titulo={loading ? "Carregando..." : "Cadastrar"} />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f8',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 20
    },
    content: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 302,
        marginTop: "auto",
        marginBottom: "auto",
        paddingTop: 70,
    },
    title: {
        marginBottom: 25,
        color: "#333",
        fontFamily: "Open Sans",
        fontSize: 20,
        textAlign: "center",
        justifyContent: "center",
    },
    inputContainer: {
        width: 400,
        display: "flex",
        flexDirection: "column",
        marginBottom: 25,
        gap: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    voltarLoginText: {
        color: "#747373",
        fontFamily: "Alumni Sans SC",
        fontSize: 16,
        textAlign: "center",
        justifyContent: "center",
        marginTop: 15,
    },
});

export default CadastroScreen;