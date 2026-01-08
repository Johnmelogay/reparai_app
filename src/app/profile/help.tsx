import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FAQS = [
    { q: 'Como solicito um serviço?', a: 'Basta escolher a categoria na tela inicial e preencher os detalhes.' },
    { q: 'Como funciona o pagamento?', a: 'O pagamento é feito diretamente ao prestador após a conclusão.' },
    { q: 'É seguro?', a: 'Sim! Todos os prestadores passam por verificação de antecedentes.' },
];

export default function HelpScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ajuda e Suporte</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Perguntas Frequentes</Text>

                {FAQS.map((item, index) => (
                    <View key={index} style={styles.faqItem}>
                        <View style={styles.faqHeader}>
                            <Text style={styles.question}>{item.q}</Text>
                        </View>
                        <Text style={styles.answer}>{item.a}</Text>
                    </View>
                ))}

                <View style={styles.contactBox}>
                    <Text style={styles.contactTitle}>Ainda precisa de ajuda?</Text>
                    <Text style={styles.contactText}>Entre em contato com nosso suporte.</Text>
                    <TouchableOpacity style={styles.contactButton}>
                        <Text style={styles.contactButtonText}>Falar com Suporte</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
    },
    faqItem: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    answer: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    contactBox: {
        marginTop: 30,
        backgroundColor: '#EFF6FF',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
    },
    contactTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginBottom: 4,
    },
    contactText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 15,
    },
    contactButton: {
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    contactButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});
