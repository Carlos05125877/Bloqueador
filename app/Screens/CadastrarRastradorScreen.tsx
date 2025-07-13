import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";
import * as React from "react";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { auth, db } from "../firebase/firebaseConfig";

const CadastroRastreadorScreen: React.FC = () => {
    const router = useRouter();
    const [numeroRastreador, setNumeroRastreador] = useState<string>("");
    const [numeroChip, setNumeroChip] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Pega o usuário logado
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserId(user?.uid ?? null);
        });
        return unsubscribe;
    }, []);

    const handleRegister = async (): Promise<void> => {
        if (!numeroRastreador || !numeroChip) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos');
            return;
        }

        // Validação simples do formato do rastreador (DDMMAAXXXX)
        if (!/^\d{8,}$/.test(numeroRastreador)) {
            Alert.alert('Erro', 'Número do rastreador inválido. Exemplo válido: 0607250002');
            return;
        }

        if (!userId) {
            Alert.alert('Erro', 'Usuário não autenticado');
            return;
        }

        setLoading(true);
        try {
            // Salva na subcoleção "rastradores" do usuário logado
            await setDoc(
                doc(collection(db, "users", userId, "rastradores"), numeroRastreador),
                {
                    numeroRastreador,
                    numeroChip,
                    createdAt: new Date().toISOString(),
                }
            );
            Alert.alert('Sucesso', 'Rastreador cadastrado com sucesso!');
            setNumeroRastreador('');
            setNumeroChip('');
            router.replace('/Screens/HomeScreen');
        } catch (error: any) {
            Alert.alert('Erro', 'Não foi possível cadastrar o rastreador');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Header title="CADASTRAR RASTREADOR"/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                <View style={styles.content}>
                    <View style={styles.inputContainer}>
                        <Input
                            label="Número do Rastreador"
                            inputType="default"
                            secureTextEntry={false}
                            value={numeroRastreador}
                            onChangeText={setNumeroRastreador}
                            placeholder="Ex: 0607250002"
                        />
                        <Input
                            label="Número do Chip"
                            inputType="default"
                            secureTextEntry={false}
                            value={numeroChip}
                            onChangeText={setNumeroChip}
                            placeholder="Número do chip"
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
    inputContainer: {
        width: 400,
        display: "flex",
        flexDirection: "column",
        marginBottom: 25,
        gap: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CadastroRastreadorScreen;