import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import SelectRastrador from "@/components/SelectRastrador";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as React from "react";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../firebase/firebaseConfig";

const VincularScreen: React.FC = () => {
    const router = useRouter();
    const [selectedRastreador, setSelectedRastreador] = useState<string>("");
    const [modeloEquipamento, setModeloEquipamento] = useState<string>("");
    const [numeroSerie, setNumeroSerie] = useState<string>("");
    const [numeroPedido, setNumeroPedido] = useState<string>("");
    const [dataInstalacao, setDataInstalacao] = useState<string>("");
    const [dataError, setDataError] = useState<string>("");
    const [tecnico, setTecnico] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Pega o usuário logado
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserId(user?.uid ?? null);
        });
        return unsubscribe;
    }, []);

    const handleVincular = async (): Promise<void> => {
        // Validação do padrão de data brasileiro
        const dataRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!selectedRastreador || !modeloEquipamento || !numeroSerie || !numeroPedido || !dataInstalacao || !tecnico) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos');
            return;
        }
        if (!dataRegex.test(dataInstalacao)) {
            setDataError('Data deve estar no formato DD/MM/AAAA');
            return;
        } else {
            setDataError("");
        }
        if (!userId) {
            Alert.alert('Erro', 'Usuário não autenticado');
            return;
        }
        setLoading(true);
        try {
            // Verificar se já existe equipamento vinculado
            const rastreadorRef = doc(db, "users", userId, "rastradores", selectedRastreador);
            const rastreadorSnap = await getDoc(rastreadorRef);
            if (rastreadorSnap.exists() && rastreadorSnap.data().equipamentoVinculado) {
                Alert.alert('Erro', 'Este rastreador já está vinculado a um equipamento.');
                setLoading(false);
                return;
            }
            console.log('Vinculando:', {
                rastreadorVinculado: selectedRastreador,
                modeloEquipamento,
                numeroSerie,
                numeroPedido,
                dataInstalacao,
                tecnico,
                createdAt: new Date().toISOString(),
            });
            
            // Salvar na coleção de rastreadores com dados do equipamento
            await setDoc(
                doc(db, "users", userId, "rastradores", selectedRastreador),
                {
                    numeroRastreador: selectedRastreador,
                    equipamentoVinculado: {
                        modeloEquipamento,
                        numeroSerie,
                        numeroPedido,
                        dataInstalacao,
                        tecnico,
                        createdAt: new Date().toISOString(),
                    }
                },
                { merge: true }
            );
            
            Alert.alert('Sucesso', 'Equipamento vinculado com sucesso!');
            setSelectedRastreador("");
            setModeloEquipamento("");
            setNumeroSerie("");
            setNumeroPedido("");
            setDataInstalacao("");
            setTecnico("");
            router.replace('/Screens/HomeScreen');
        } catch (error: any) {
            console.log('Erro ao vincular:', error);
            Alert.alert('Erro', 'Não foi possível vincular o equipamento');
        } finally {
            setLoading(false);
        }
    };

    // Função para aplicar máscara de data DD/MM/AAAA
    const handleDataChange = (text: string) => {
        // Remove tudo que não for número
        let cleaned = text.replace(/\D/g, "");
        // Aplica a máscara
        if (cleaned.length > 2 && cleaned.length <= 4) {
            cleaned = cleaned.replace(/(\d{2})(\d+)/, "$1/$2");
        } else if (cleaned.length > 4) {
            cleaned = cleaned.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
        }
        setDataInstalacao(cleaned);
    };

    return (
        <View style={styles.container}>
            <Header title="VINCULAR RASTREADOR"/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                <View style={styles.content}>
                    <View style={styles.inputContainer}>
                        <SelectRastrador selected={selectedRastreador} onSelect={setSelectedRastreador} />
                        <Input
                            label="Modelo do Equipamento"
                            inputType="default"
                            secureTextEntry={false}
                            value={modeloEquipamento}
                            onChangeText={setModeloEquipamento}
                            placeholder="Ex: Modelo X"
                        />
                        <Input
                            label="Número de Série"
                            inputType="default"
                            secureTextEntry={false}
                            value={numeroSerie}
                            onChangeText={setNumeroSerie}
                            placeholder="Número de série"
                        />
                        <Input
                            label="Pedido de Venda / Ordem de Produção"
                            inputType="default"
                            secureTextEntry={false}
                            value={numeroPedido}
                            onChangeText={setNumeroPedido}
                            placeholder="Pedido/Ordem"
                        />
                        <Input
                            label="Data de Instalação"
                            inputType="numeric"
                            secureTextEntry={false}
                            value={dataInstalacao}
                            onChangeText={handleDataChange}
                            placeholder="DD/MM/AAAA"
                        />
                        {dataError ? <Text style={{ color: 'red', fontSize: 13 }}>{dataError}</Text> : null}
                        <Input
                            label="Técnico Instalador"
                            inputType="default"
                            secureTextEntry={false}
                            value={tecnico}
                            onChangeText={setTecnico}
                            placeholder="Nome do técnico"
                        />
                    </View>
                    <Button onPress={handleVincular} titulo={loading ? "Carregando..." : "Vincular"} />
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

export default VincularScreen;