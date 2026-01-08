import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ArrowLeft, CreditCard, Plus } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CARDS = [
    { id: '1', last4: '4242', brand: 'Visa' },
    { id: '2', last4: '8899', brand: 'Mastercard' },
];

export default function PaymentsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pagamentos</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Seus Cartões</Text>

                {CARDS.map(card => (
                    <View key={card.id} style={styles.cardItem}>
                        <View style={styles.cardInfo}>
                            <CreditCard size={24} color="#666" />
                            <Text style={styles.cardText}>•••• {card.last4}</Text>
                        </View>
                        <Text style={styles.cardBrand}>{card.brand}</Text>
                    </View>
                ))}

                <TouchableOpacity style={styles.addButton}>
                    <Plus size={20} color={Colors.light.primary} />
                    <Text style={styles.addButtonText}>Adicionar Novo Cartão</Text>
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginLeft: 12,
    },
    cardBrand: {
        fontSize: 14,
        color: '#666',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.light.primary,
        borderRadius: 12,
        borderStyle: 'dashed',
        marginTop: 10,
    },
    addButtonText: {
        color: Colors.light.primary,
        fontWeight: '600',
        marginLeft: 8,
    }
});
