import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Perfil</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nome Completo</Text>
                    <TextInput style={styles.input} defaultValue="João Silva" />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput style={styles.input} defaultValue="joao.silva@email.com" keyboardType="email-address" />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Telefone</Text>
                    <TextInput style={styles.input} defaultValue="(69) 99312-9559" keyboardType="phone-pad" />
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={() => router.back()}>
                    <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        padding: 15,
        borderRadius: 12,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    saveButton: {
        backgroundColor: Colors.light.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
