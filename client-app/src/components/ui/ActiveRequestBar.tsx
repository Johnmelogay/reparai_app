import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActiveRequestBarProps {
    status: 'finding' | 'offered' | string | null;
    category: string | null;
}

export function ActiveRequestBar({ status, category }: ActiveRequestBarProps) {
    const router = useRouter();

    if (status !== 'finding' && status !== 'offered') {
        return null;
    }

    return (
        <TouchableOpacity
            style={styles.activeRequestBar}
            onPress={() => router.push('/request/new/match')}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.pulseDot} />
                <Text style={styles.activeRequestText}>
                    {status === 'finding' ? 'Buscando profissional...' : 'Aguardando resposta...'}
                    <Text style={{ fontWeight: 'normal', fontSize: 12 }}> • {category || 'Solicitação'}</Text>
                </Text>
            </View>
            <ChevronRight size={20} color="#fff" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    activeRequestBar: {
        position: 'absolute',
        bottom: 90, // above tabs
        left: 20,
        right: 20,
        backgroundColor: '#222',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    pulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.light.success,
        marginRight: 10,
    },
    activeRequestText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
